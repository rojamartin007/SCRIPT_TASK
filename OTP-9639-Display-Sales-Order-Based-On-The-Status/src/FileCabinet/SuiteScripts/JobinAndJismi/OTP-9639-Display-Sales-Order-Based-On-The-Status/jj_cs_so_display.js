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

define(['N/url'], 
/**
 * @param {url} url - NetSuite URL module
 */
(url) => {
  const scriptId = 'customscript_jj_sl_so_status';
  const deploymentId = 'customdeploy_jj_sl_so_status';

  /**
   * Reset Filters button handler.
   * Clears all filters and reloads the Suitelet with default values.
   * 
   * @returns {void}
   */
  function resetFilters() {
    try {
      const resolvedUrl = url.resolveScript({
        scriptId,
        deploymentId,
        params: {} 
      });

    
      window.location.replace(resolvedUrl);
    } catch (error) {
      console.error('Reset Filters failed:', error);
    }
  }

  return { resetFilters };
});
