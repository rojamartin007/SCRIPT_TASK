/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */

/************************************************************************************************ 
 *  
 * OTP-9780 : Search through the database to find the matching blood donors
 * 
************************************************************************************************* 
 * 
 * Author: Jobin and Jismi IT Services 
 * 
 * Date Created : 30-October-2025 
 * 
 * Description : Suitelet script to filter and display eligible blood donors based on blood group and last donation date.
 * 
 * REVISION HISTORY
 *
 * @version 1.0 : 30-October-2025 :  The initial build was created by JJ0418
 * 
*************************************************************************************************/

/**
 * @param {serverWidget} serverWidget - NetSuite UI module for form creation
 * @param {search} search - NetSuite Search module
 */
define(['N/ui/serverWidget', 'N/search'], function (serverWidget, search) {

    const CUSTOM_RECORD_TYPE = 'customrecord_jj_blood_donor_record';
    const CLIENT_SCRIPT_PATH = './jj_cs_search_blood_donors.js';

    /**
     * Entry point for the Suitelet script.
     * @param {Object} context - Suitelet context
     * @param {ServerRequest} context.request - Incoming request
     * @param {ServerResponse} context.response - Suitelet response
     */
    function onRequest(context) {
        try {
            log.debug('Suitelet Triggered', 'Request method: ' + context.request.method);
            renderDonorSearchForm(context);
        } catch (error) {
            log.error('Error in onRequest', error.message);
        }
    }

    /**
     * Renders the blood donor search form and displays results if filters are applied.
     * @param {Object} context - Suitelet context
     */
    function renderDonorSearchForm(context) {
        try {
            const form = serverWidget.createForm({ title: 'Blood Donor Search' });
            form.clientScriptModulePath = CLIENT_SCRIPT_PATH;

            const bloodGroupField = addBloodGroupField(form);
            const selectedBloodGroup = context.request.parameters.custpage_blood_group_filter;
            const donorList = getEligibleDonors(selectedBloodGroup);

            if (selectedBloodGroup) {
                bloodGroupField.defaultValue = selectedBloodGroup;
            }

            displayResults(form, donorList);
            form.addSubmitButton({ label: 'Search' });
            context.response.writePage(form);

        } catch (error) {
            log.error('Error in renderDonorSearchForm', error.message);
        }
    }

    /**
     * Adds the blood group dropdown field to the form.
     * @param {Form} form - NetSuite UI form
     * @returns {Field} - The created blood group field
     */
    function addBloodGroupField(form) {
        try {
            const bloodGroupField = form.addField({
                id: 'custpage_blood_group_filter',
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

            return bloodGroupField;
        } catch (error) {
            log.error('Error in addBloodGroupField', error.message);
        }
    }

    /**
     * Executes a search to retrieve eligible blood donors based on filters.
     * @param {string} bloodGroupValue - Selected blood group ID
     * @returns {Array<Object>} - List of eligible donors
     */
    function getEligibleDonors(bloodGroupValue) {
        try {
            const filters = [
                ['custrecord_jj_last_donation_date', 'onorbefore', 'threemonthsagotodate'],
                 'AND',
            ['isinactive', 'is', 'F']
            ];

            if (bloodGroupValue) {
                filters.push('AND');
                filters.push(['custrecord_jj_blood_group', 'is', bloodGroupValue]);
            }

            const donorSearch = search.create({
                type: CUSTOM_RECORD_TYPE,
                filters: filters,
                columns: [
                    'custrecord_jj_first_name',
                    'custrecord_jj_last_name',
                    'custrecord_jj_phone_number',
                    'custrecord_jj_gender',
                    'custrecord_jj_last_donation_date',
                    'custrecord_jj_blood_group'
                ]
            });

            const donorResults = [];
            donorSearch.run().each(function (result) {
                donorResults.push({
                    name: result.getValue('custrecord_jj_first_name') + ' ' + result.getValue('custrecord_jj_last_name'),
                    phone: result.getValue('custrecord_jj_phone_number'),
                    bloodGroup: result.getText('custrecord_jj_blood_group'),
                    gender: result.getText('custrecord_jj_gender'),
                    lastDonation: result.getValue('custrecord_jj_last_donation_date')
                });
                return true;
            });

            return donorResults;
        } catch (error) {
            log.error('Error in getEligibleDonors', error.message);
            return [];
        }
    }

    /**
     * Displays the donor search results on the form.
     * @param {Form} form - NetSuite UI form
     * @param {Array<Object>} donorList - List of eligible donors
     */
    function displayResults(form, donorList) {
        try {
            const resultMessageField = form.addField({
                id: 'custpage_result_msg',
                type: serverWidget.FieldType.INLINEHTML,
                label: ' '
            });

            resultMessageField.defaultValue = `<b>Found ${donorList.length} eligible donor(s)</b>`;

            if (donorList.length > 0) {
                const donorSublist = form.addSublist({
                    id: 'custpage_donors',
                    type: serverWidget.SublistType.LIST,
                    label: 'Eligible Donors'
                });

                donorSublist.addField({ id: 'custpage_name', type: serverWidget.FieldType.TEXT, label: 'Name' });
                donorSublist.addField({ id: 'custpage_phone', type: serverWidget.FieldType.PHONE, label: 'Phone Number' });
                donorSublist.addField({ id: 'custpage_bloodgroup', type: serverWidget.FieldType.TEXT, label: 'Blood Group' });
                donorSublist.addField({ id: 'custpage_gender', type: serverWidget.FieldType.TEXT, label: 'Gender' });
                donorSublist.addField({ id: 'custpage_lastdonation', type: serverWidget.FieldType.DATE, label: 'Last Donation Date' });

                for (let i = 0; i < donorList.length; i++) {
                    donorSublist.setSublistValue({ id: 'custpage_name', line: i, value: donorList[i].name });
                    donorSublist.setSublistValue({ id: 'custpage_phone', line: i, value: donorList[i].phone });
                    donorSublist.setSublistValue({ id: 'custpage_bloodgroup', line: i, value: donorList[i].bloodGroup });
                    donorSublist.setSublistValue({ id: 'custpage_gender', line: i, value: donorList[i].gender });
                    donorSublist.setSublistValue({ id: 'custpage_lastdonation', line: i, value: donorList[i].lastDonation });
                }
            } else {
                const noResultField = form.addField({
                    id: 'custpage_no_result',
                    type: serverWidget.FieldType.INLINEHTML,
                    label: ' '
                });
                noResultField.defaultValue = '<p>No eligible donors found.</p>';
            }
        } catch (error) {
            log.error('Error in displayResults', error.message);
        }
    }

    return {
        onRequest: onRequest
    };
});
