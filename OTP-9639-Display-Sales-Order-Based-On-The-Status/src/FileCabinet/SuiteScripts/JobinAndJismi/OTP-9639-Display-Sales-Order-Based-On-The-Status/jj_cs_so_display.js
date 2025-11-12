/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 */

/************************************************************************************************ 
 *  
 * OTP-9639 : Custom page for displaying sales orders based on status
 * 
 ************************************************************************************************* 
 * 
 * Author: Jobin and Jismi IT Services 
 * 
 * Date Created : 22-October-2025 
 * 
 * Description : Client script to reload the Suitelet form when any filter field is changed.
 *               It captures selected filter values and reloads the Suitelet with those values
 *               passed as URL parameters.
 * 
 * REVISION HISTORY
 *
 * @version 1.0 : 22-October-2025  : Initial version created by JJ0418
 * 
 *************************************************************************************************/ 


define(['N/url', 'N/currentRecord'], 
/**
 * @param {url} url
 * @param {currentRecord} currentRecord
 */
(url, currentRecord) => {
  const scriptId = 'customscript_jj_sl_so_status';
  const deploymentId = 'customdeploy_jj_sl_so_status';

  /**
   * Triggered when a field value changes on the form.
   * 
   * If the changed field is one of the filters, the function collects all current filter values
   * and reloads the Suitelet with those values as URL parameters.
   * 
   * @param {Object} context - Field change context
   * @param {string} context.fieldId - ID of the field that changed
   */
  const fieldChanged = (context) => {
    try {
      const record = currentRecord.get();

      const fieldMap = {
        custpage_jj_status_filter: 'custpage_jj_status_filter',
        custpage_jj_customer_filter: 'custpage_jj_customer_filter',
        custpage_jj_subsidiary_filter: 'custpage_jj_subsidiary_filter',
        custpage_jj_department_filter: 'custpage_jj_department_filter'
      };

      if (Object.keys(fieldMap).includes(context.fieldId)) {
        const params = {};

        Object.keys(fieldMap).forEach(fieldId => {
          const value = record.getValue({ fieldId });
          if (value) {
            params[fieldMap[fieldId]] = value;
          }
        });

        const resolvedUrl = url.resolveScript({
          scriptId,
          deploymentId,
          params
        });

        window.location.href = resolvedUrl;
      }
    } catch (error) {
      console.error('Field change handling failed:', error);
      alert('An error occurred while applying filters. Please try again.');
    }
  };

  return { fieldChanged };
});
