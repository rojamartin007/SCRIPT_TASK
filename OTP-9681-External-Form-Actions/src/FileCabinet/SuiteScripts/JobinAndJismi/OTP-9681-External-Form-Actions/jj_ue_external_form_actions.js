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
 * Description : UserEvent script sends notifications when external customer inquiries are submitted. 
 * 
 * REVISION HISTORY
 *
 * @version 1.0 : 25-October-2025 : Initial build by JJ0418
 * 
*************************************************************************************************/

define(['N/search', 'N/email', 'N/record'],
  /**
   * @param {search} search - NetSuite search module
   * @param {email} email - NetSuite email module
   * @param {record} record - NetSuite record module
   */
  (search, email, record) => {

    /**
     * Triggered after a record is submitted
     * @param {Object} scriptContext - Context object
     * @param {Record} scriptContext.newRecord - Newly created record
     * @param {string} scriptContext.type - Event type (CREATE, EDIT, DELETE)
     */
    const afterSubmit = (scriptContext) => {
      try {
        if (scriptContext.type !== scriptContext.UserEventType.CREATE) return;

        const newRec = scriptContext.newRecord;
        const custName = newRec.getValue('custrecord_jj_customer_name');
        const custEmail = newRec.getValue('custrecord_jj_customer_email');
        const subject = newRec.getValue('custrecord_jj_subject');
        const message = newRec.getValue('custrecord_jj_message');
        const customerId = newRec.getValue('custrecord_jj_linked_customer');


        if (!customerId) {
          log.audit({
            title: 'No Customer Linked',
            details: `External form email ${custEmail || 'N/A'} did not match any customer.`
          });
        } else {

          try {
            record.submitFields({
              type: record.Type.CUSTOMER,
              id: customerId,
              values: {
                custentity_jj_last_inquiry: newRec.id
              },
              options: {
                ignoreMandatoryFields: true
              }
            });

            log.audit({
              title: 'Customer Linked to Inquiry',
              details: `Customer ID=${customerId}, Inquiry ID=${newRec.id}`
            });
          } catch (linkError) {
              log.error({
                title: 'Error Linking Inquiry to Customer',
                details: linkError
              });
          }
        }

        const { salesRepEmail, isSalesRepActive } = customerId
          ? getSalesRepInfo(customerId)
          : { salesRepEmail: null, isSalesRepActive: false };

        sendNotifications(custName, custEmail, subject, message, customerId, salesRepEmail, isSalesRepActive);
      } catch (error) {
          log.error({
            title: 'Error in afterSubmit',
            details: error
          });
      }
    };

    /**
     * Retrieves active Sales Rep information for a customer
     * @param {number} customerId - Internal ID of the customer
     * @returns {{salesRepEmail: string|null, isSalesRepActive: boolean}} Sales Rep details
     */
    const getSalesRepInfo = (customerId) => {
      try {
        const customerSearch = search.create({
          type: search.Type.CUSTOMER,
          filters: [
            ['internalid', 'is', customerId],
            'AND',
            ['salesrep.isinactive', 'is', 'F']
          ],
          columns: [
            search.createColumn({ name: 'salesrep' }),
            search.createColumn({ name: 'email', join: 'salesrep' }),
            search.createColumn({ name: 'isinactive', join: 'salesrep' })
          ]
        });

        const results = customerSearch.run().getRange({ start: 0, end: 1 });

        if (!results || results.length === 0) {
          log.audit({
            title: 'Customer or Active Sales Rep Not Found',
            details: `No customer or sales rep inactive for ID: ${customerId}`
          });
          return { salesRepEmail: null, isSalesRepActive: false };
        }

        const salesRepId = results[0].getValue('salesrep');
        const salesRepEmail = results[0].getValue({ name: 'email', join: 'salesrep' });

        if (!salesRepId || !salesRepEmail) {
          log.audit({
            title: 'Sales Rep Missing Info',
            details: `ID=${salesRepId || 'N/A'}, Email=${salesRepEmail || 'N/A'}`
          });
          return { salesRepEmail: null, isSalesRepActive: false };
        }

        log.audit({
          title: 'Active Sales Rep Email Found',
          details: salesRepEmail
        });
        return { salesRepEmail, isSalesRepActive: true };

      } catch (error) {
          log.error({
            title: 'Error in getSalesRepInfo',
            details: error
          });
        return { salesRepEmail: null, isSalesRepActive: false };
      }
    };

    /**
     * Sends notification emails to Admin and Sales Rep
     * @param {string} custName - Customer name
     * @param {string} custEmail - Customer email
     * @param {string} subject - Inquiry subject
     * @param {string} message - Inquiry message
     * @param {number|null} customerId - Linked customer ID
     * @param {string|null} salesRepEmail - Sales Rep email
     * @param {boolean} isSalesRepActive - Whether Sales Rep is active
     */
    const sendNotifications = (custName, custEmail, subject, message, customerId, salesRepEmail, isSalesRepActive) => {
      try {
        const adminId = -5;

        const formattedMessage = `
                    <p><b>Customer Name:</b> ${custName || 'Not Provided'}</p>
                    <p><b>Email:</b> ${custEmail || 'Not Provided'}</p>
                    <p><b>Subject:</b> ${subject || 'Not Provided'}</p>
                    <p><b>Message:</b><br>${message || 'No message provided'}</p>
                    <p><b>Linked Customer:</b> ${customerId || 'No match found'}</p>
                `;


        const adminEmailBody = `
                    <p>Dear Admin,</p>
                    <p>A new external contact form has been submitted. The details are as follows:</p>
                    ${formattedMessage}
                    <br>
                    <p>Best regards,<br><b>NetSuite Automated Notification</b></p>
                `;

        email.send({
          author: adminId,
          recipients: adminId,
          subject: `New External Form Submission - ${subject || 'No Subject'}`,
          body: adminEmailBody
        });
        log.audit({
          title: 'Admin Email Sent',
          details: `To Admin ID=${adminId}`
        });


        if (salesRepEmail && isSalesRepActive) {
          const salesRepEmailBody = `
                        <p>Dear Sales Representative,</p>
                        <p>A new customer has submitted an inquiry through the external contact form. The details are below:</p>
                        ${formattedMessage}
                        <br>
                        <p>Best regards,<br><b>NetSuite Automated Notification</b></p>
                    `;

          email.send({
            author: adminId,
            recipients: salesRepEmail,
            subject: `New Customer Submission - ${custName || 'Unnamed Customer'}`,
            body: salesRepEmailBody
          });
          log.audit({
            title: 'Sales Rep Email Sent',
            details: salesRepEmail
          });
        } else {
          log.audit({
            title: 'Sales Rep Notification Skipped',
            details: 'No active Sales Rep email available.'
          });
        }

      } catch (error) {
          log.error({
            title: 'Error in sendNotifications',
            details: error
          });
      }
    };

    return { afterSubmit };
  });
