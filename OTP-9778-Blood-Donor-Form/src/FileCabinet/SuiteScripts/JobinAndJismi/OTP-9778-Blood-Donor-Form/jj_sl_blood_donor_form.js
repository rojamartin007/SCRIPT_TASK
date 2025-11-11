/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */

/************************************************************************************************ 
 *  
 * OTP-9778 : Custom form to store blood donor details and track them in database
 * 
************************************************************************************************* 
 * 
 * Author: Jobin and Jismi IT Services 
 * 
 * Date Created : 29-October-2025 
 * 
 * Description : Suitelet script to capture blood donor details via a traditional NetSuite form.
 * 
 * REVISION HISTORY
 *
 * @version 1.0 : 29-October-2025 : Initial build by JJ0418
 * 
*************************************************************************************************/ 

define(['N/ui/serverWidget', 'N/record'],
(serverWidget, record) => {

    /**
     * Entry point for the Suitelet script. Determines whether to render the form or process submission.
     * @param {Object} context - Suitelet context object
     * @param {ServerRequest} context.request - Incoming request object
     * @param {ServerResponse} context.response - Response object to write output
     * @returns {void}
     */
    function onRequest(context) {
        try {
            if (context.request.method === 'GET') {
                renderBloodRequirementForm(context);
            } else {
                handleFormSubmission(context);
            }
        } catch (error) {
            log.error('onRequest Error', error.message || error.toString());
        }
    }

    /**
     * Renders the blood requirement registration form using NetSuite's standard UI components.
     * @param {Object} context - Suitelet context object
     * @param {ServerResponse} context.response - Response object to write the form
     * @returns {void}
     */
    function renderBloodRequirementForm(context) {
        try {
            const form = serverWidget.createForm({
                title: 'Blood Requirement Registration'
            });

            form.addField({
                id: 'custpage_first_name',
                type: serverWidget.FieldType.TEXT,
                label: 'First Name'
            }).isMandatory = true;

            form.addField({
                id: 'custpage_last_name',
                type: serverWidget.FieldType.TEXT,
                label: 'Last Name'
            }).isMandatory = true;

            const genderField = form.addField({
                id: 'custpage_gender',
                type: serverWidget.FieldType.SELECT,
                label: 'Gender'
            });
            genderField.isMandatory = true;
            genderField.addSelectOption({ value: '', text: '' });
            genderField.addSelectOption({ value: '1', text: 'Male' });
            genderField.addSelectOption({ value: '2', text: 'Female' });
            genderField.addSelectOption({ value: '3', text: 'Other' });

            form.addField({
                id: 'custpage_phone_number',
                type: serverWidget.FieldType.PHONE,
                label: 'Phone Number'
            }).isMandatory = true;

            const bloodGroupField = form.addField({
                id: 'custpage_blood_group',
                type: serverWidget.FieldType.SELECT,
                label: 'Blood Group'
            });
            bloodGroupField.isMandatory = true;
            bloodGroupField.addSelectOption({ value: '', text: '' });
            bloodGroupField.addSelectOption({ value: 'A+', text: 'A+' });
            bloodGroupField.addSelectOption({ value: 'A-', text: 'A-' });
            bloodGroupField.addSelectOption({ value: 'B+', text: 'B+' });
            bloodGroupField.addSelectOption({ value: 'B-', text: 'B-' });
            bloodGroupField.addSelectOption({ value: 'AB+', text: 'AB+' });
            bloodGroupField.addSelectOption({ value: 'AB-', text: 'AB-' });
            bloodGroupField.addSelectOption({ value: 'O+', text: 'O+' });
            bloodGroupField.addSelectOption({ value: 'O-', text: 'O-' });

            form.addField({
                id: 'custpage_last_donation_date',
                type: serverWidget.FieldType.DATE,
                label: 'Last Donation Date'
            }).isMandatory = true;

            form.addSubmitButton({ label: 'Submit' });

            context.response.writePage(form);
        } catch (error) {
            log.error('renderBloodRequirementForm Error', error.message || error.toString());
        }
    }

    /**
     * Handles form submission, validates input, and saves the data to a custom record.
     * Displays a success or error message based on the outcome.
     * @param {Object} context - Suitelet context object
     * @param {ServerRequest} context.request - Request object containing submitted form data
     * @param {ServerResponse} context.response - Response object to write confirmation or error
     * @returns {void}
     */
    function handleFormSubmission(context) {
        try {
            const params = context.request.parameters;

            const donationDate = new Date(params.custpage_last_donation_date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (isNaN(donationDate.getTime())) {
                throw new Error('Invalid date format.');
            }

            if (donationDate > today) {
                throw new Error('Last Donation Date cannot be in the future.');
            }

            const donorRecord = record.create({
                type: 'customrecord_blood_donor_request',
                isDynamic: true
            });

            donorRecord.setValue({ fieldId: 'custrecord_first_name', value: params.custpage_first_name });
            donorRecord.setValue({ fieldId: 'custrecord_last_name', value: params.custpage_last_name });
            donorRecord.setValue({ fieldId: 'custrecord_gender', value: params.custpage_gender });
            donorRecord.setValue({ fieldId: 'custrecord_phone_number', value: params.custpage_phone_number });
            donorRecord.setValue({ fieldId: 'custrecord_blood_group', value: params.custpage_blood_group });
            donorRecord.setValue({ fieldId: 'custrecord_last_donation_date', value: donationDate });

            donorRecord.save();

            const confirmationForm = serverWidget.createForm({ title: 'Submission Successful' });
            const messageField = confirmationForm.addField({
                id: 'custpage_success_msg',
                type: serverWidget.FieldType.INLINEHTML,
                label: 'Success'
            });
            messageField.defaultValue = '<div style="color:green;font-weight:bold;">Blood requirement registered successfully.</div>';
            context.response.writePage(confirmationForm);

        } catch (error) {
            log.error('handleFormSubmission Error', error.message || error.toString());

            const errorForm = serverWidget.createForm({ title: 'Submission Failed' });
            const errorField = errorForm.addField({
                id: 'custpage_error_msg',
                type: serverWidget.FieldType.INLINEHTML,
                label: 'Error'
            });
            errorField.defaultValue = `<div style="color:red;font-weight:bold;">Error: ${error.message}</div>`;
            context.response.writePage(errorForm);
        }
    }

    return {
        onRequest
    };
});
