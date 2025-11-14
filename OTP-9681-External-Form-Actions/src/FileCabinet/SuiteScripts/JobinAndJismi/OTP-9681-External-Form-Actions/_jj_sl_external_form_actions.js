/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
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
 * Description : Suitelet script enables external users to submit customer queries directly into NetSuite without login access. 
 * 
 * REVISION HISTORY
 *
 * @version 1.0 : 25-October-2025 : Initial build by JJ0418
 * 
*************************************************************************************************/

define(['N/ui/serverWidget', 'N/record', 'N/search'],
  /**
   * @param {serverWidget} serverWidget - NetSuite UI module
   * @param {record} record - NetSuite record module
   * @param {search} search - NetSuite search module
   * 
   */
  (serverWidget, record, search) => {

    /**
     * Suitelet entry point
     * @param {Object} scriptContext - Context object
     * @param {ServerRequest} scriptContext.request - Incoming request
     * @param {ServerResponse} scriptContext.response - Suitelet response
     */
    const onRequest = (scriptContext) => {
      try {
        if (scriptContext.request.method === 'GET') {
          const form = createContactForm();
          scriptContext.response.writePage(form);
        } else if (scriptContext.request.method === 'POST') {
          const custName = scriptContext.request.parameters.custpage_custname;
          const custEmail = scriptContext.request.parameters.custpage_email;
          const subject = scriptContext.request.parameters.custpage_subject;
          const message = scriptContext.request.parameters.custpage_message;

          if (isDuplicateEmail(custEmail)) {
            log.audit({
              title: 'Duplicate Submission Blocked',
              details: `Email already exists: ${custEmail}`
            });
            scriptContext.response.write(`
                            <script>
                                alert('A record with this email address already exists. Please use a different email or contact support.');
                                history.back();
                            </script>
                        `);
            return;
          }

          const customerId = getCustomerByEmail(custEmail);
          const recordId = createCustomRecord(custName, custEmail, subject, message, customerId);



          scriptContext.response.write(`
                        <h2>Thank you for your submission!</h2>
                        <p>Your message has been successfully submitted.</p>
                    `);
        }
      } catch (error) {
          log.error({
            title: 'Error in onRequest',
            details: error
          });
          scriptContext.response.write('<h2>Error:</h2><p>' + error.message + '</p>');
      }
    };

    /**
     * Creates Suitelet form for external customer contact
     * @returns {N/ui/serverWidget.Form} Suitelet form object
     */
    const createContactForm = () => {
      try {
        const form = serverWidget.createForm({
          title: 'External Customer Contact Form'
        });

        form.addField({
          id: 'custpage_custname',
          type: serverWidget.FieldType.TEXT,
          label: 'Customer Name'
        }).isMandatory = true;

        form.addField({
          id: 'custpage_email',
          type: serverWidget.FieldType.EMAIL,
          label: 'Customer Email'
        }).isMandatory = true;

        form.addField({
          id: 'custpage_subject',
          type: serverWidget.FieldType.TEXT,
          label: 'Subject'
        }).isMandatory = true;

        form.addField({
          id: 'custpage_message',
          type: serverWidget.FieldType.LONGTEXT,
          label: 'Message'
        }).isMandatory = true;

        form.addSubmitButton({ label: 'Submit' });
        form.addResetButton({ label: 'Reset' });

        return form;
      } catch (error) {
          log.error({
            title: 'Error in createContactForm',
            details: error
          });
          throw error;
      }
    };

    /**
     * Retrieves customer internal ID by email
     * @param {string} custEmail - Customer email
     * @returns {number|null} Internal ID or null if not found
     */
    const getCustomerByEmail = (custEmail) => {
      try {
        const result = search.create({
          type: search.Type.CUSTOMER,
          filters: [['email', 'is', custEmail]],
          columns: ['internalid']
        }).run().getRange({ start: 0, end: 1 });

        return result.length > 0 ? result[0].getValue('internalid') : null;
      } catch (error) {
          log.error({
            title: 'Error in getCustomerByEmail',
            details: error
          });
          throw error;
      }
    };

    /**
     * Checks for duplicate email in custom record
     * @param {string} custEmail - Email to check
     * @returns {boolean} True if duplicate exists
     */
    const isDuplicateEmail = (custEmail) => {
      try {
        const duplicateSearch = search.create({
          type: 'customrecord_jj_customer_inquiry',
          filters: [['custrecord_jj_customer_email', 'is', custEmail]],
          columns: ['internalid']
        }).run().getRange({ start: 0, end: 1 });

        return duplicateSearch.length > 0;
      } catch (error) {
          log.error({
            title: 'Error in isDuplicateEmail',
            details: error
          });
          throw error;
      }
    };

    /**
     * Creates custom record for customer submission
     * @param {string} custName - Customer name
     * @param {string} custEmail - Customer email
     * @param {string} subject - Subject
     * @param {string} message - Message
     * @param {number|null} customerId - Related customer ID
     * @returns {number} Created record ID
     */
    const createCustomRecord = (custName, custEmail, subject, message, customerId) => {
      try {
        const customRecord = record.create({
          type: 'customrecord_jj_customer_inquiry',
          isDynamic: true
        });

        customRecord.setValue({ fieldId: 'custrecord_jj_customer_name', value: custName });
        customRecord.setValue({ fieldId: 'custrecord_jj_customer_email', value: custEmail });
        customRecord.setValue({ fieldId: 'custrecord_jj_subject', value: subject });
        customRecord.setValue({ fieldId: 'custrecord_jj_message', value: message });

        if (customerId) {
          customRecord.setValue({
            fieldId: 'custrecord_jj_linked_customer',
            value: customerId
          });
        }

        return customRecord.save({
          enableSourcing: true,
          ignoreMandatoryFields: true
        });
      } catch (error) {
          log.error({
            title: 'Error in createCustomRecord',
            details: error
          });
          throw error;
      }
    };

    return { onRequest };
  });
