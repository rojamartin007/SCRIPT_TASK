/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */

/************************************************************************************************ 
 * OTP-9639 : Custom page for displaying sales orders based on status
 *  
 * 
************************************************************************************************* 
 * 
 * Author: Jobin and Jismi IT Services 
 * 
 * Date Created : 22-October-2025 
 * 
 * Description : Suitelet script to filter and display sales orders based on status, customer, 
 *               subsidiary, and department. Results are shown in a sublist.
 * 
 * REVISION HISTORY
 *
 * @version 1.0 : 22-October-2025  : Initial version created by JJ0418
 * 
************************************************************************************************/
define(['N/search', 'N/ui/serverWidget'], (search, serverWidget) => {

  const CLIENT_SCRIPT_PATH = './jj_cs_so_display.js';


  /**
 * Entry point for the Suitelet script execution.
 * 
 * This function handles both GET and POST requests to render a form that allows users
 * to filter and view Sales Orders based on selected criteria such as status, customer,
 * subsidiary, and department. It builds the form, applies default filter values, runs
 * a search based on those filters, and populates a sublist with the results.
 * 
 * Error handling is included to log unexpected issues and provide a user-friendly message.
 * 
 * @param {Object} scriptContext - The context object provided by NetSuite Suitelet runtime.
 * @param {ServerRequest} scriptContext.request - The incoming HTTP request object.
 * @param {ServerResponse} scriptContext.response - The response object used to render the Suitelet page.
 */

  const onRequest = (scriptContext) => {
    try {
      const { request, response } = scriptContext;

      const form = createFormWithFilters();
      applyDefaultFilterValues(form, request.parameters);

      const sublist = buildSalesOrderSublist(form);
      const filters = buildSearchFilters(request.parameters);
      const results = runSalesOrderSearch(filters);

      populateSublistWithResults(sublist, results);

      response.writePage(form);
    } catch (e) {
      log.error('Suitelet Error', e);
      scriptContext.response.write('An unexpected error occurred. Please contact your administrator.');
     
    }
  };



  /**
  * Creates and returns a Suitelet form with filter fields for Sales Order search.
  * 
  * The form includes dropdowns for Status, Customer, Subsidiary, and Department,
  * and sets the client script module path for client-side interaction.
  * 
  * @returns {serverWidget.Form} The constructed form object with filter fields
  */
  function createFormWithFilters() {
    try {
      const form = serverWidget.createForm({ title: 'Sales Orders by Status' });
      form.clientScriptModulePath = CLIENT_SCRIPT_PATH;

      const statusField = form.addField({
        id: 'custpage_jj_status_filter',
        type: serverWidget.FieldType.SELECT,
        label: 'Status',
        source: 'salesorderstatus'
      });
      statusField.addSelectOption({ value: '', text: '' });
      statusField.addSelectOption({ value: 'SalesOrd:B', text: 'Pending Fulfillment' });
      statusField.addSelectOption({ value: 'SalesOrd:F', text: 'Pending Billing' });

      form.addField({
        id: 'custpage_jj_customer_filter',
        type: serverWidget.FieldType.SELECT,
        label: 'Customer',
        source: 'customer'
      });

      form.addField({
        id: 'custpage_jj_subsidiary_filter',
        type: serverWidget.FieldType.SELECT,
        label: 'Subsidiary',
        source: 'subsidiary'
      });

      form.addField({
        id: 'custpage_jj_department_filter',
        type: serverWidget.FieldType.SELECT,
        label: 'Department',
        source: 'department'
      });

      log.audit('Form Creation', 'Sales Order filter form created successfully');
      return form;
    } catch (error) {
      log.error('Form Creation Failed', error);
      throw error; // Re-throw to be handled by the calling function
    }
  }
  /**
   * Applies default values to the filter fields on the form based on request parameters.
   * 
   * Iterates through expected filter field IDs and sets their default values if present
   * in the request parameters. Logs any failures during field access or value assignment.
   * 
   * @param {serverWidget.Form} form - The Suitelet form object
   * @param {Object} params - The request parameters containing filter values
   */
  function applyDefaultFilterValues(form, params) {
    try {
      const filterIds = [
        'custpage_jj_status_filter',
        'custpage_jj_customer_filter',
        'custpage_jj_subsidiary_filter',
        'custpage_jj_department_filter'
      ];

      filterIds.forEach(id => {
        if (params[id]) {
          try {
            form.getField({ id }).defaultValue = params[id];
          } catch (e) {
            log.debug(`Default value set failed for ${id}`, e);
          }
        }
      });

      log.audit('Default Filters Applied', JSON.stringify(params));
    } catch (error) {
      log.error('applyDefaultFilterValues Error', error);
    }
  }


  /**
   * Builds and returns a sublist to display Sales Order search results.
   * 
   * Adds fields for internal ID, transaction details, customer, financials, and classification.
   * Logs success or failure during sublist construction.
   * 
   * @param {serverWidget.Form} form - The Suitelet form object
   * @returns {serverWidget.Sublist} The constructed sublist object
   */
  function buildSalesOrderSublist(form) {
    try {
      const sublist = form.addSublist({
        id: 'custpage_jj_salesorder_sublist',
        type: serverWidget.SublistType.LIST,
        label: 'Sales Orders'
      });

      const fields = [
        { id: 'custpage_jj_so_internalid', type: serverWidget.FieldType.TEXT, label: 'Internal ID' },
        { id: 'custpage_jj_so_tranid', type: serverWidget.FieldType.TEXT, label: 'Document Name' },
        { id: 'custpage_jj_so_date', type: serverWidget.FieldType.DATE, label: 'Date' },
        { id: 'custpage_jj_so_status', type: serverWidget.FieldType.TEXT, label: 'Status' },
        { id: 'custpage_jj_so_customer', type: serverWidget.FieldType.TEXT, label: 'Customer Name' },
        { id: 'custpage_jj_so_subsidiary', type: serverWidget.FieldType.TEXT, label: 'Subsidiary' },
        { id: 'custpage_jj_so_department', type: serverWidget.FieldType.TEXT, label: 'Department' },
        { id: 'custpage_jj_so_class', type: serverWidget.FieldType.TEXT, label: 'Class' },
        { id: 'custpage_jj_so_subtotal', type: serverWidget.FieldType.CURRENCY, label: 'Subtotal' },
        { id: 'custpage_jj_so_tax', type: serverWidget.FieldType.CURRENCY, label: 'Tax' },
        { id: 'custpage_jj_so_total', type: serverWidget.FieldType.CURRENCY, label: 'Total' }
      ];

      fields.forEach(field => sublist.addField(field));

      log.audit('Sublist Created', 'Sales Order sublist fields added successfully');
      return sublist;
    } catch (error) {
      log.error('buildSalesOrderSublist Error', error);
      throw error;
    }
  }

  /**
   * Builds an array of search filters for the Sales Order search based on request parameters.
   * 
   * Includes default filters for mainline and status, and conditionally adds filters for
   * status, customer, subsidiary, and department if provided.
   * 
   * @param {Object} params - Request parameters containing filter values
   * @returns {Array} Array of search filters
   */
  function buildSearchFilters(params) {
    try {
      const filters = [
        ['mainline', 'is', 'T'],
        'AND',
        ['status', 'anyof', ['SalesOrd:B', 'SalesOrd:F']]
      ];

      if (params.custpage_jj_status_filter) {
        filters.push('AND', ['status', 'anyof', params.custpage_jj_status_filter]);
      }
      if (params.custpage_jj_customer_filter) {
        filters.push('AND', ['entity', 'anyof', params.custpage_jj_customer_filter]);
      }
      if (params.custpage_jj_subsidiary_filter) {
        filters.push('AND', ['subsidiary', 'anyof', params.custpage_jj_subsidiary_filter]);
      }
      if (params.custpage_jj_department_filter) {
        filters.push('AND', ['department', 'anyof', params.custpage_jj_department_filter]);
      }

      log.debug('Search Filters Built', JSON.stringify(filters));
      return filters;
    } catch (error) {
      log.error('buildSearchFilters Error', error);
      return [];
    }
  }


  /**
  * Executes a Sales Order search using the provided filters and returns the results.
  * 
  * Retrieves key fields including transaction details, customer, classification, and financials.
  * 
  * @param {Array} filters - Array of search filters
  * @returns {Array} Array of search.Result objects
  */
  function runSalesOrderSearch(filters) {
    try {
      const soSearch = search.create({
        type: search.Type.SALES_ORDER,
        filters,
        columns: [
          'internalid', 'tranid', 'trandate', 'statusref', 'entity',
          'subsidiary', 'department', 'class', 'grossamount', 'taxamount', 'amount'
        ]
      });

      const results = [];
      soSearch.run().each(result => {
        results.push(result);
        return true;
      });

      log.audit('Sales Order Search Completed', `Records found: ${results.length}`);
      return results;
    } catch (error) {
      log.error('runSalesOrderSearch Error', error);
      return [];
    }
  }


  /**
   * Populates the sublist with Sales Order search results.
   * 
   * Uses safeSet to assign values to each sublist field, ensuring type safety and error handling.
   * 
   * @param {serverWidget.Sublist} sublist - The sublist to populate
   * @param {Array} results - Array of search.Result objects
   */
  function populateSublistWithResults(sublist, results) {
    try {
      log.debug('Populating Sublist', `Total results: ${results.length}`);

      results.forEach((result, line) => {
        safeSet(sublist, { id: 'custpage_jj_so_internalid', line, value: result.getValue('internalid') });
        safeSet(sublist, { id: 'custpage_jj_so_tranid', line, value: result.getValue('tranid') });
        safeSet(sublist, { id: 'custpage_jj_so_date', line, value: result.getValue('trandate') });
        safeSet(sublist, { id: 'custpage_jj_so_status', line, value: result.getText('statusref') });
        safeSet(sublist, { id: 'custpage_jj_so_customer', line, value: result.getText('entity') });
        safeSet(sublist, { id: 'custpage_jj_so_subsidiary', line, value: result.getText('subsidiary') });
        safeSet(sublist, { id: 'custpage_jj_so_department', line, value: result.getText('department') });
        safeSet(sublist, { id: 'custpage_jj_so_class', line, value: result.getText('class') });
        safeSet(sublist, { id: 'custpage_jj_so_subtotal', line, value: result.getValue('grossamount') });
        safeSet(sublist, { id: 'custpage_jj_so_tax', line, value: result.getValue('taxamount') });
        safeSet(sublist, { id: 'custpage_jj_so_total', line, value: result.getValue('amount') });
      });

      log.audit('Sublist Population Complete', `Lines populated: ${results.length}`);
    } catch (error) {
      log.error('populateSublistWithResults Error', error);
    }
  }
  /**
   * Safely sets a value in a sublist field, converting it to a string if necessary.
   * 
   * Handles null or undefined values gracefully, formats Date objects to ISO date strings,
   * and logs any errors encountered during assignment.
   * 
   * @param {serverWidget.Sublist} sublist - The sublist object to modify
   * @param {Object} options - Parameters for setting the sublist value
   * @param {string} options.id - The field ID in the sublist
   * @param {number} options.line - The line number to set the value on
   * @param {*} options.value - The value to assign to the field
   */
  function safeSet(sublist, { id, line, value }) {
    try {
      let val = value ?? '';
      if (val instanceof Date) {
        val = val.toISOString().split('T')[0]; // Format date as YYYY-MM-DD
      } else {
        val = String(val); // Ensure value is a string
      }
      sublist.setSublistValue({ id, line, value: val });
    } catch (err) {
      log.error('safeSet failed', {
        fieldId: id,
        lineNumber: line,
        attemptedValue: value,
        error: err.message || err
      });
    }
  }

  return { onRequest };
});
