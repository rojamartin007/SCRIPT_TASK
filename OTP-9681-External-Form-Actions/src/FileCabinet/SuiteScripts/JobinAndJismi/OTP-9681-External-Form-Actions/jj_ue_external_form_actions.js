/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */

/************************************************************************************************ 
 *  
 * OTP-9681 : External Custom Record form and actions
 * 
************************************************************************************************* 
 * 
 * Author: Jobin and Jismi IT Services 
 * 
 * Date Created : 25-October-2025  
 * 
 * Description : User Event script triggered on creation of a custom inquiry record. 
 *               It links the inquiry to a matching customer and sends notifications to admin and sales rep.
 * 
 * REVISION HISTORY
 *
 * @version 1.0 : 25-October-2025  : Initial version created by JJ0418
 * 
*************************************************************************************************/

define(['N/record', 'N/search', 'N/email', 'N/runtime'],
  /**
   * @param {record} record
   * @param {search} search
   * @param {email} email
   * @param {runtime} runtime
   */
  function (record, search, email, runtime) {

    const ADMIN_ID = -5;

    /**
     * Searches for a customer using the provided email address.
     * @param {string} emailValue - Email address to search
     * @returns {search.Result|null} Matching customer result or null
     */
    function findCustomerByEmail(emailValue) {
      try {
        const customerSearch = search.create({
          type: search.Type.CUSTOMER,
          filters: [['email', 'is', emailValue]],
          columns: ['internalid', 'salesrep']
        });

        const result = customerSearch.run().getRange({ start: 0, end: 1 });
        return result.length > 0 ? result[0] : null;
      } catch (error) {
        log.error({ title: 'Customer Search Error', details: error });
        return null;
      }
    }

    /**
     * Links the inquiry record to the matched customer.
     * @param {number} inquiryId - Internal ID of the inquiry record
     * @param {number} customerId - Internal ID of the customer
     */
    function linkCustomerToInquiry(inquiryId, customerId) {
      try {
        const inquiryRecord = record.load({
          type: 'customrecord_jj_customer_inquiry',
          id: inquiryId,
          isDynamic: true
        });

        inquiryRecord.setValue({
          fieldId: 'custrecord_jj_linked_customer',
          value: customerId
        });

        inquiryRecord.save();
      } catch (error) {
          log.error({ title: 'Linking Error', details: error });
      }
    }

    /**
     * Sends an email notification to the admin about the new inquiry.
     * @param {string} name - Customer name
     * @param {string} emailValue - Customer email
     * @param {string} subject - Inquiry subject
     * @param {string} message - Inquiry message
     */
    function notifyAdmin(name, emailValue, subject, message) {
      try {
        const emailBody = `
       A new customer inquiry has been submitted:

       Customer Name: ${name}
       Customer Email: ${emailValue}
       Subject: ${subject}
       Message:
       ${message}

       Please review the inquiry in NetSuite.
      `;

        email.send({
          author: runtime.getCurrentUser().id,
          recipients: ADMIN_ID,
          subject: 'New Customer Inquiry Submitted',
          body: emailBody
        });
      } catch (error) {
          log.error({ title: 'Admin Notification Error', details: error });
      }
    }

    /**
     * Sends an email notification to the sales rep assigned to the customer.
     * @param {number} salesRepId - Internal ID of the sales rep
     * @param {string} name - Customer name
     * @param {string} emailValue - Customer email
     * @param {string} subject - Inquiry subject
     * @param {string} message - Inquiry message
     */
    function notifySalesRep(salesRepId, name, emailValue, subject, message) {
      try {
        const emailBody = `
          You have received a new inquiry from your customer:

          Customer Name: ${name}
          Customer Email: ${emailValue}
          Subject: ${subject}
          Message:
          ${message}

          Please follow up as needed.
                `;

        email.send({
          author: runtime.getCurrentUser().id,
          recipients: salesRepId,
          subject: 'Customer Inquiry Notification',
          body: emailBody
        });
      } catch (error) {
          log.error({ title: 'Sales Rep Notification Error', details: error });
      }
    }

    /**
     * Triggered after a new inquiry record is submitted.
     * @param {UserEventContext} context - User event context
     */
    function afterSubmit(context) {
      if (context.type !== context.UserEventType.CREATE) return;

      try {
        const newRecord = context.newRecord;
        const emailValue = newRecord.getValue('custrecord_jj_customer_email');
        const nameValue = newRecord.getValue('custrecord_jj_customer_name');
        const subjectValue = newRecord.getValue('custrecord_jj_subject');
        const messageValue = newRecord.getValue('custrecord_jj_message');

        if (!emailValue) return;

        notifyAdmin(nameValue, emailValue, subjectValue, messageValue);

        const customer = findCustomerByEmail(emailValue);
        if (customer) {
          const customerId = customer.getValue('internalid');
          const salesRepId = customer.getValue('salesrep');

          linkCustomerToInquiry(newRecord.id, customerId);

          if (salesRepId) {
            notifySalesRep(salesRepId, nameValue, emailValue, subjectValue, messageValue);
          }
        }
      } catch (error) {
          log.error({ title: 'afterSubmit Error', details: error });
      }
    }

    return {
      afterSubmit: afterSubmit
    };
  });
