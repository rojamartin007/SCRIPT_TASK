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
 * Description : Suitelet script to allow external users to submit customer inquiries into NetSuite 
 *               without requiring login access. Captures name, email, subject, and message.
 * 
 * REVISION HISTORY
 *
 * @version 1.0 : 25-October-2025  : Initial version created by JJ0418
 * 
*************************************************************************************************/ 


define(['N/ui/serverWidget', 'N/record'], 
/**
 * @param {serverWidget} serverWidget
 * @param {record} record
 */
function(serverWidget, record) {

  /**
   * Builds and returns the Suitelet form for customer inquiry submission.
   * @returns {serverWidget.Form} A form object with input fields and submit button
   */
  function buildForm() {
    const form = serverWidget.createForm({ title: 'Customer Inquiry Form' });

    form.addField({
      id: 'custpage_name',
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
      type: serverWidget.FieldType.TEXTAREA,
      label: 'Message'
    }).isMandatory = true;

    form.addSubmitButton({ label: 'Submit Inquiry' });
    return form;
  }

  /**
   * Creates a custom record to store the submitted inquiry details.
   * @param {Object} params - Form parameters
   * @param {string} params.name - Customer name
   * @param {string} params.email - Customer email
   * @param {string} params.subject - Inquiry subject
   * @param {string} params.message - Inquiry message
   */
  function createInquiryRecord(params) {
    try {
      const inquiry = record.create({
        type: 'customrecord_jj_customer_inquiry',
        isDynamic: true
      });

      inquiry.setValue({ fieldId: 'custrecord_jj_customer_name', value: params.name });
      inquiry.setValue({ fieldId: 'custrecord_jj_customer_email', value: params.email });
      inquiry.setValue({ fieldId: 'custrecord_jj_subject', value: params.subject });
      inquiry.setValue({ fieldId: 'custrecord_jj_message', value: params.message });

      const recordId = inquiry.save();
      log.audit('Inquiry Record Created', `Record ID: ${recordId}`);
    } catch (error) {
      log.error({ title: 'Create Inquiry Error', details: error });
    }
  }

  /**
   * Entry point for Suitelet execution.
   * @param {Object} context - Suitelet context
   * @param {ServerRequest} context.request - Incoming request object
   * @param {ServerResponse} context.response - Response object to write output
   */
  function onRequest(context) {
    if (context.request.method === 'GET') {
      log.debug('Suitelet Request', 'Rendering inquiry form');
      context.response.writePage(buildForm());
    } else {
      try {
        const params = {
          name: context.request.parameters.custpage_name,
          email: context.request.parameters.custpage_email,
          subject: context.request.parameters.custpage_subject,
          message: context.request.parameters.custpage_message
        };

        log.debug('Form Submission Received', JSON.stringify(params));
        createInquiryRecord(params);
        context.response.write('Thank you! Your inquiry has been submitted.');
      } catch (error) {
        log.error({ title: 'Form Submission Error', details: error });
        context.response.write('An error occurred. Please try again later.');
      }
    }
  }

  return {
    onRequest: onRequest
  };
});