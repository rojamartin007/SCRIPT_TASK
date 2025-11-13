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
     * Creates a saved search to retrieve overdue invoices from the previous month.
     * @returns {search.Search} A NetSuite search object for overdue invoices.
     */
    const createInvoiceSearch = () => {
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
          search.createColumn({
            name: 'formulanumeric',
            formula: '{today} - {duedate}',
            label: 'Days Overdue'
          })
        ]
      });
    };

    /**
     * Retrieves the customer's email and validates the assigned Sales Rep.
     * If the customer or Sales Rep is inactive, returns fallback sender.
     * @param {string} customerId - Internal ID of the customer.
     * @returns {{email: string|null, salesRepId: number}} Email and valid Sales Rep ID.
     */
    const getCustomerEmailAndSalesRep = (customerId) => {
      try {
        const customerRecord = record.load({
          type: record.Type.CUSTOMER,
          id: customerId
        });

        const isInactive = customerRecord.getValue('isinactive');
        if (isInactive === true) {
          log.audit('Inactive Customer', `Customer ${customerId} is inactive`);
          return { email: null, salesRepId: fallbackSenderId };
        }

        const email = customerRecord.getValue('email');
        if (!email) {
          log.audit('Missing Email', `Customer ${customerId} has no email`);
          return { email: null, salesRepId: fallbackSenderId };
        }

        const salesRepId = customerRecord.getValue('salesrep');
        if (!salesRepId) {
          return { email, salesRepId: fallbackSenderId };
        }

        // Validate Sales Rep is active
        try {
          const employeeRecord = record.load({
            type: record.Type.EMPLOYEE,
            id: salesRepId
          });

          const isRepInactive = employeeRecord.getValue('isinactive');
          if (isRepInactive === true) {
            log.audit('Inactive Sales Rep', `Sales Rep ${salesRepId} is inactive`);
            return { email, salesRepId: fallbackSenderId };
          }

          return { email, salesRepId };
        } catch (repError) {
            log.error('Sales Rep Load Error', repError.message);
            return { email, salesRepId: fallbackSenderId };
        }

      } catch (error) {
          log.error('getCustomerEmailAndSalesRep Error', error.message);
          return { email: null, salesRepId: fallbackSenderId };
      }
    };

    /**
     * Generates a CSV file containing overdue invoice details for a customer.
     * @param {string} customerName - Name of the customer.
     * @param {Array<Object>} invoiceList - List of invoice details.
     * @param {string} customerEmail - Email address of the customer.
     * @returns {file.File} NetSuite file object representing the CSV.
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
     * Sends an email to the customer with the overdue invoice CSV attached.
     * @param {number} senderId - Internal ID of the sender (Sales Rep or fallback).
     * @param {string} customerId - Internal ID of the customer.
     * @param {string} customerName - Name of the customer.
     * @param {file.File} csvFile - CSV file object to attach.
     * @param {string} customerEmail - Email address of the customer.
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
      } catch (error) {
          log.error('sendEmailWithCsv Error', error.message);
      }
    };

    /**
     * Defines the input data for the Map/Reduce process.
     * @returns {search.Search} The search object containing overdue invoices.
     */
    const getInputData = () => {
      return createInvoiceSearch();
    };

    /**
     * Processes each invoice record and prepares it for reduction.
     * @param {Object} context - NetSuite map context.
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
          customerName: invoice.entity.text
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
     * Groups invoices by customer and sends email notifications with CSV attachments.
     * @param {Object} context - NetSuite reduce context.
     */
    const reduce = (context) => {
      try {
        const customerId = context.key;
        const invoiceList = context.values.map(JSON.parse);
        const customerName = invoiceList[0].customerName;

        const { email: customerEmail, salesRepId } = getCustomerEmailAndSalesRep(customerId);
        if (!customerEmail) {
          log.audit('Skipping Email', `Customer ${customerId} skipped due to missing email or inactive status`);
          return;
        }

        const csvFile = generateCsvFile(customerName, invoiceList, customerEmail);
        sendEmailWithCsv(salesRepId, customerId, customerName, csvFile, customerEmail);
      } catch (error) {
          log.error('reduce Error', error.message);
      }
    };

    return { getInputData, map, reduce };
  });
