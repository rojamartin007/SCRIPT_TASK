/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */

/************************************************************************************************ 
 *  
 * OTP-9682 : Monthly Overdue Reminder for Customer
 * 
************************************************************************************************* 
 * 
 * Author: Jobin and Jismi IT Services 
 * 
 * Date Created : 24-October-2025 
 * 
 * Description : Map/Reduce script identifies overdue invoices, groups them by customer, 
 * generates a CSV summary, and sends email notifications with the CSV attached.
 * 
 * REVISION HISTORY
 *
 * @version 1.1 : 24-October-2025  : The initial build was created by JJ0418
 * 
*************************************************************************************************/ 

define(['N/search', 'N/file', 'N/email', 'N/record'],
(search, file, email, record) => {

  const fallbackSenderId = -5; 

  /**
   * Creates a saved search to retrieve overdue invoices.
   * @returns {Search} NetSuite search object
   */
  const createInvoiceSearch = () => {
    try {
      return search.create({
        type: search.Type.INVOICE,
        filters: [
          ['duedate', 'onorbefore', 'lastmonth'],
          'AND',
          ['status', 'anyof', ['CustInvc:A']],
          'AND',
          ['mainline', 'is', 'T']
        ],
        columns: [
          'internalid',
          'tranid',
          'entity',
          'amount',
          'duedate',
          'salesrep',
          search.createColumn({
            name: 'formulanumeric',
            formula: '{today} - {duedate}',
            label: 'Days Overdue'
          })
        ]
      });
    } catch (error) {
      log.error('createInvoiceSearch Error', error.message);
    }
  };

  /**
   * Logs each result from the invoice search for debugging.
   * @param {Search} invoiceSearch - NetSuite search object
   */
  const logInvoiceResults = (invoiceSearch) => {
    try {
      invoiceSearch.run().each(result => {
        const customerName = result.getText('entity');
        const invoiceNumber = result.getValue('tranid');
        const invoiceAmount = result.getValue('amount');
        const dueDate = result.getValue('duedate');
        const daysOverdue = result.getValue({
          name: 'formulanumeric',
          formula: '{today} - {duedate}'
        });

        log.debug('Invoice Result', `Customer: ${customerName}, Invoice: ${invoiceNumber}, Amount: ${invoiceAmount}, Due: ${dueDate}, Days Overdue: ${daysOverdue}`);
        return true;
      });
    } catch (error) {
      log.error('logInvoiceResults Error', error.message);
    }
  };

  /**
   * Retrieves the email address of a customer.
   * @param {string} customerId - Internal ID of the customer
   * @returns {string|null} Email address or null if not found
   */
  const getCustomerEmail = (customerId) => {
    try {
      return record.load({
        type: record.Type.CUSTOMER,
        id: customerId
      }).getValue('email');
    } catch (error) {
      log.error('getCustomerEmail Error', error.message);
      return null;
    }
  };

  /**
   * Generates a CSV file containing overdue invoice details.
   * @param {string} customerName - Name of the customer
   * @param {Array<Object>} invoiceList - List of invoice objects
   * @param {string} customerEmail - Email address of the customer
   * @returns {File} NetSuite file object
   */
  const generateCsvFile = (customerName, invoiceList, customerEmail) => {
    try {
      const csvLines = ['Customer Name,Customer Email,Invoice Number,Invoice Amount,Due Date,Days Overdue'];
      invoiceList.forEach(invoice => {
        csvLines.push(`${invoice.customerName},${customerEmail},${invoice.invoiceNumber},${invoice.invoiceAmount},${invoice.dueDate},${invoice.daysOverdue.toFixed(0)}`);
      });

      const csvFile = file.create({
        name: `Overdue_Invoices_${customerName}.csv`,
        fileType: file.Type.CSV,
        contents: csvLines.join('\n'),
        folder: 204 // Replace with your File Cabinet folder ID
      });

      csvFile.save();
      return csvFile;
    } catch (error) {
      log.error('generateCsvFile Error', error.message);
    }
  };

  /**
   * Sends an email to the customer with the CSV file attached.
   * @param {number} senderId - Internal ID of the sender (employee)
   * @param {string} customerId - Internal ID of the customer
   * @param {string} customerName - Name of the customer
   * @param {File} csvFile - NetSuite file object
   * @param {string} customerEmail - Email address of the customer
   */
  const sendEmailWithCsv = (senderId, customerId, customerName, csvFile, customerEmail) => {
    try {
      email.send({
        author: senderId,
        recipients: customerId,
        subject: 'Monthly Overdue Invoice Notification',
        body: `Dear ${customerName},\n\nPlease find attached your overdue invoices as of last month.\n\nRegards,\nFinance Team`,
        attachments: [csvFile]
      });

      log.audit('Email Sent', `Email sent to ${customerName} (${customerEmail}) from sender ID ${senderId}.`);
    } catch (error) {
      log.error('sendEmailWithCsv Error', error.message);
    }
  };

  /**
   * Retrieves input data for the Map/Reduce process.
   * @returns {Search} NetSuite search object
   */
  const getInputData = () => {
    try {
      log.debug('getInputData', 'Starting overdue invoice search');
      const invoiceSearch = createInvoiceSearch();
      logInvoiceResults(invoiceSearch);
      return invoiceSearch;
    } catch (error) {
      log.error('getInputData Error', error.message);
    }
  };

  /**
   * Processes each invoice record and prepares it for reduction.
   * @param {MapContext} context - NetSuite map context
   */
  const map = (context) => {
    try {
      const result = JSON.parse(context.value);
      const invoice = result.values;

      const customerId = invoice.entity.value;
      const invoiceDetails = {
        invoiceId: result.id,
        invoiceNumber: invoice.tranid,
        invoiceAmount: invoice.amount,
        dueDate: invoice.duedate,
        daysOverdue: parseFloat(invoice.formulanumeric),
        customerName: invoice.entity.text,
        salesRepId: invoice.salesrep ? invoice.salesrep.value : null
      };

      context.write({
        key: customerId,
        value: invoiceDetails
      });
    } catch (error) {
      log.error('map Error', error.message);
    }
  };

  /**
   * Groups invoices by customer and sends email notifications.
   * @param {ReduceContext} context - NetSuite reduce context
   */
  const reduce = (context) => {
    try {
      const customerId = context.key;
      const invoiceList = context.values.map(JSON.parse);
      const customerName = invoiceList[0].customerName;
      const salesRepId = invoiceList[0].salesRepId;

      const customerEmail = getCustomerEmail(customerId);
      if (!customerEmail) {
        log.error('Missing Email', `Customer ${customerName} (${customerId}) has no email`);
        return;
      }

      const csvFile = generateCsvFile(customerName, invoiceList, customerEmail);
      const senderId = salesRepId || fallbackSenderId;

      sendEmailWithCsv(senderId, customerId, customerName, csvFile, customerEmail);
    } catch (error) {
      log.error('reduce Error', error.message);
    }
  };

  return { getInputData, map, reduce };
});
