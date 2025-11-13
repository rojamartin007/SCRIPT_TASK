/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
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
 * Description : Client script to validate blood group selection before submitting the Blood Donor Search form.
 * 
 * REVISION HISTORY
 *
 * @version 1.0 : 30-October-2025 :  The initial build was created by JJ0418
 * 
*************************************************************************************************/

/**
 * @param {dialog} dialog - NetSuite UI dialog module for alerts
 */
define(['N/ui/dialog'], function (dialog) {

    /**
     * Triggered when the page is initialized.
     * @param {Object} context - Page initialization context
     */
    function pageInit(context) {
        console.log('Client Script Loaded');
    }

    /**
     * Validates the form before submission.
     * Ensures that a blood group is selected.
     * @param {Object} context - Save record context
     * @returns {boolean} - True if valid, false if validation fails
     */
    function saveRecord(context) {
        try {
            const record = context.currentRecord;
            const bloodGroup = record.getValue({ fieldId: 'custpage_blood_group_filter' });

            console.log('saveRecord triggered');
            console.log('Blood Group:', bloodGroup);

            if (!bloodGroup) {
                dialog.alert({
                    title: 'Missing Information',
                    message: 'Please select a Blood Group before searching.'
                });
                return false;
            }

            return true;

        } catch (e) {
            console.error('Error in saveRecord', e.message);
            return false;
        }
    }

    return {
        pageInit: pageInit,
        saveRecord: saveRecord
    };
});
