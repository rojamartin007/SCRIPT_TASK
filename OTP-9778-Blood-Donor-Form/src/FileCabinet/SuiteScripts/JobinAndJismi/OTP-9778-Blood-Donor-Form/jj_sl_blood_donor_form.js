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



define(['N/ui/serverWidget', 'N/record', 'N/log', 'N/search'],
    /**
     * @param {serverWidget} serverWidget - NetSuite UI module for building forms
     * @param {record} record - NetSuite record module for CRUD operations
     * @param {log} log - NetSuite logging module
     * @param {search} search - NetSuite search module
     */
    function (serverWidget, record, log, search) {

        /**
         * Entry point for Suitelet execution.
         *
         * @param {Object} context - Suitelet context object
         * @param {ServerRequest} context.request - Incoming request object
         * @param {ServerResponse} context.response - Outgoing response object
         */
        function onRequest(context) {
            try {
                if (context.request.method === 'GET') {
                    displayForm(context);
                } else {
                    saveRecord(context);
                }
            } catch (e) {
                log.error('Error in onRequest', e.message || e.toString());
            }
        }

        /**
         * Displays the blood donor registration form.
         *
         * @param {Object} context - Suitelet context object
         */
        function displayForm(context) {
            try {
                const form = serverWidget.createForm({
                    title: 'Blood Donor Registration Form'
                });

           
                form.addField({
                    id: 'custrecord_jj_first_name',
                    type: serverWidget.FieldType.TEXT,
                    label: 'First Name'
                }).isMandatory = true;

            
                form.addField({
                    id: 'custrecord_jj_last_name',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Last Name'
                }).isMandatory = true;

                const genderField = form.addField({
                    id: 'custrecord_jj_gender',
                    type: serverWidget.FieldType.SELECT,
                    label: 'Gender'
                });
                genderField.isMandatory = true;
                genderField.addSelectOption({ value: '', text: '' });
                genderField.addSelectOption({ value: '1', text: 'Male' });
                genderField.addSelectOption({ value: '2', text: 'Female' });
                genderField.addSelectOption({ value: '3', text: 'Others' });

           
                form.addField({
                    id: 'custrecord_jj_phone_number',
                    type: serverWidget.FieldType.PHONE,
                    label: 'Phone Number'
                }).isMandatory = true;

              
                const bloodGroupField = form.addField({
                    id: 'custrecord_jj_blood_group',
                    type: serverWidget.FieldType.SELECT,
                    label: 'Blood Group'
                });
                bloodGroupField.isMandatory = true;
                bloodGroupField.addSelectOption({ value: '', text: '' });
                bloodGroupField.addSelectOption({ value: '1', text: 'A+' });
                bloodGroupField.addSelectOption({ value: '2', text: 'A-' });
                bloodGroupField.addSelectOption({ value: '3', text: 'B+' });
                bloodGroupField.addSelectOption({ value: '4', text: 'B-' });
                bloodGroupField.addSelectOption({ value: '5', text: 'AB+' });
                bloodGroupField.addSelectOption({ value: '6', text: 'AB-' });
                bloodGroupField.addSelectOption({ value: '7', text: 'O+' });
                bloodGroupField.addSelectOption({ value: '8', text: 'O-' });

              
                form.addField({
                    id: 'custrecord_jj_last_donation_date',
                    type: serverWidget.FieldType.DATE,
                    label: 'Last Donation Date'
                }).isMandatory = true;

                form.addSubmitButton({ label: 'Submit' });

                context.response.writePage(form);
            } catch (error) {
                log.error('displayForm Error', error.message || error.toString());
            }
        }

        /**
         * Saves the submitted donor details to the custom record.
         * Prevents duplicate donors based on phone number.
         *
         * @param {Object} context - Suitelet context object
         */
        function saveRecord(context) {
            try {
                const params = context.request.parameters;
                const rawDate = params['custrecord_jj_last_donation_date'];
                const donationDate = new Date(rawDate);

                if (isNaN(donationDate.getTime())) {
                    throw new Error('Invalid date format submitted.');
                }

                const today = new Date();
                today.setHours(0, 0, 0, 0);

                if (donationDate > today) {
                    throw new Error('Last Donation Date cannot be a future date.');
                }

            
                const phoneNumber = (params['custrecord_jj_phone_number'] || '').trim();
                if (!phoneNumber) {
                    throw new Error('Phone Number is required.');
                }

            
                const phoneRegex = /^[0-9]{10}$/;
                if (!phoneRegex.test(phoneNumber)) {
                    throw new Error('Invalid Phone Number. Please enter exactly 10 digits (only numbers allowed).');
                }

                // 🔍 Duplicate check
                const donorSearch = search.create({
                    type: 'customrecord_jj_blood_donor_record',
                    filters: [
                        ['custrecord_jj_phone_number', 'is', phoneNumber]
                    ],
                    columns: ['internalid']
                });

                const results = donorSearch.run().getRange({ start: 0, end: 1 });
                if (results && results.length > 0) {
                    throw new Error('Duplicate donor found. A record with this phone number already exists.');
                }

                const donorRecord = record.create({
                    type: 'customrecord_jj_blood_donor_record',
                    isDynamic: true
                });

                donorRecord.setValue({
                    fieldId: 'custrecord_jj_first_name',
                    value: params['custrecord_jj_first_name'] || ''
                });

                donorRecord.setValue({
                    fieldId: 'custrecord_jj_last_name',
                    value: params['custrecord_jj_last_name'] || ''
                });

                donorRecord.setValue({
                    fieldId: 'custrecord_jj_gender',
                    value: params['custrecord_jj_gender'] || ''
                });

                donorRecord.setValue({
                    fieldId: 'custrecord_jj_phone_number',
                    value: phoneNumber
                });

                donorRecord.setValue({
                    fieldId: 'custrecord_jj_blood_group',
                    value: params['custrecord_jj_blood_group'] || ''
                });

                donorRecord.setValue({
                    fieldId: 'custrecord_jj_last_donation_date',
                    value: donationDate
                });

                donorRecord.save();

             
                const form = serverWidget.createForm({
                    title: 'Blood Donor Registration'
                });

                const msgField = form.addField({
                    id: 'custpage_confirmation_msg',
                    type: serverWidget.FieldType.INLINEHTML,
                    label: 'Confirmation'
                });
                msgField.defaultValue = '<div style="color:green;font-weight:bold;">Donor Registered Successfully.</div>';
                context.response.writePage(form);

            } catch (error) {
                log.error('saveRecord Error', error.message || error.toString());

                const errForm = serverWidget.createForm({ title: 'Error' });
                const errField = errForm.addField({
                    id: 'custpage_error_msg',
                    type: serverWidget.FieldType.INLINEHTML,
                    label: 'Error'
                });
                errField.defaultValue = `<div style="padding:10px;border:1px solid #d32f2f;background:#ffebee;color:#c62828;font-weight:600;">Save Failed: ${error.message}</div>`;
                context.response.writePage(errForm);
            }
        }

        return {
            onRequest: onRequest
        };
    });
