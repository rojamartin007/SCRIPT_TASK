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

define(['N/search', 'N/ui/serverWidget', 'N/log'], (search, serverWidget, log) => {

  const CLIENT_SCRIPT_PATH = './jj_cs_so_display.js';

  /**
 * Handles Suitelet requests by building the form, applying filters,
 * running the sales order search, and rendering results.
 *
 * @param {Object} scriptContext - Suitelet context
 * @param {ServerRequest} scriptContext.request - Incoming request with parameters
 * @param {ServerResponse} scriptContext.response - Response used to render the form
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

      form.addSubmitButton({ label: 'Apply Filters' });
      form.addButton({ id: 'custpage_reset_btn', label: 'Reset Filters', functionName: 'resetFilters' });

      response.writePage(form);
    } catch (e) {
      log.error('Suitelet Error', e);
      scriptContext.response.write('An unexpected error occurred. Please contact your administrator.');
    }
  };

  /**
 * Creates the Suitelet form with filter fields for status, customer, subsidiary, and department.
 *
 * @returns {serverWidget.Form} Form object with configured filters
 */


  function createFormWithFilters() {
    try {
      const form = serverWidget.createForm({ title: 'Sales Orders by Status' });
      form.clientScriptModulePath = CLIENT_SCRIPT_PATH;

      const statusField = form.addField({
        id: 'custpage_status_filter',
        type: serverWidget.FieldType.SELECT,
        label: 'Status',
        source: 'salesorderstatus'
      });

     
      statusField.addSelectOption({ value: 'SalesOrd:B', text: 'Pending Fulfillment' });
      statusField.addSelectOption({ value: 'SalesOrd:D', text: 'Partially Fulfilled' });
      statusField.addSelectOption({ value: 'SalesOrd:E', text: 'Pending Billing/Partially Fulfilled' });
      statusField.addSelectOption({ value: 'SalesOrd:F', text: 'Pending Billing' });

      form.addField({
        id: 'custpage_customer_filter',
        type: serverWidget.FieldType.SELECT,
        label: 'Customer',
        source: 'customer'
      });

      form.addField({
        id: 'custpage_subsidiary_filter',
        type: serverWidget.FieldType.SELECT,
        label: 'Subsidiary',
        source: 'subsidiary'
      });

      form.addField({
        id: 'custpage_department_filter',
        type: serverWidget.FieldType.SELECT,
        label: 'Department',
        source: 'department'
      });

      return form;
    } catch (e) {
      log.error('createFormWithFilters Error', e);
    }
  }

  /**
   * Applies default values to the filter fields on the Suitelet form
   * based on the provided request parameters.
   *
   * @param {serverWidget.Form} form - The Suitelet form object
   * @param {Object} params - Request parameters containing filter values
   */



  function applyDefaultFilterValues(form, params) {
  try {
    ['custpage_status_filter', 'custpage_customer_filter', 'custpage_subsidiary_filter', 'custpage_department_filter']
      .forEach(id => {
        if (params[id]) {
          form.getField({ id }).defaultValue = params[id];
        }
      });
  } catch (e) {
    log.error('applyDefaultFilterValues Error', e);
  }
}

  /**
 * Builds and returns a sublist to display sales orders with key details
 * such as internal ID, document name, date, status, customer, subsidiary,
 * department, class, subtotal, tax, and total.
 *
 * @param {serverWidget.Form} form - The Suitelet form object to which the sublist is added
 * @returns {serverWidget.Sublist} Sublist object configured with sales order fields
 */


 function buildSalesOrderSublist(form) {
  try {
    const sublist = form.addSublist({
      id: 'custpage_salesorder_sublist',
      type: serverWidget.SublistType.LIST,
      label: 'Sales Orders'
    });

    const fields = [
      { id: 'custpage_so_internalid', type: serverWidget.FieldType.TEXT, label: 'Internal ID' },
      { id: 'custpage_so_tranid', type: serverWidget.FieldType.TEXT, label: 'Document Name' },
      { id: 'custpage_so_date', type: serverWidget.FieldType.DATE, label: 'Date' },
      { id: 'custpage_so_status', type: serverWidget.FieldType.TEXT, label: 'Status' },
      { id: 'custpage_so_customer', type: serverWidget.FieldType.TEXT, label: 'Customer Name' },
      { id: 'custpage_so_subsidiary', type: serverWidget.FieldType.TEXT, label: 'Subsidiary' },
      { id: 'custpage_so_department', type: serverWidget.FieldType.TEXT, label: 'Department' },
      { id: 'custpage_so_class', type: serverWidget.FieldType.TEXT, label: 'Class' },
      { id: 'custpage_so_subtotal', type: serverWidget.FieldType.CURRENCY, label: 'Subtotal' },
      { id: 'custpage_so_tax', type: serverWidget.FieldType.CURRENCY, label: 'Tax' },
      { id: 'custpage_so_total', type: serverWidget.FieldType.CURRENCY, label: 'Total' }
    ];

    fields.forEach(field => sublist.addField(field));
    return sublist;
  } catch (e) {
    log.error('buildSalesOrderSublist Error', e);
    return null;
  }
}

  /**
 * Builds search filters for the sales order search based on request parameters.
 * Includes default conditions to exclude non-mainline, shipping, COGS, discount, and tax lines.
 * If no status filter is provided, defaults to the four required statuses.
 *
 * @param {Object} params - Request parameters containing filter values
 * @returns {Array} filters - Array of search filter conditions
 */


  function buildSearchFilters(params) {
    try {
      const filters = [
        ['mainline', 'is', 'F'], 'AND',
        ['shipping', 'is', 'F'], 'AND',
        ['cogs', 'is', 'F'], 'AND',
        ['item.type', 'noneof', 'Discount'], 'AND',
        ['taxline', 'is', 'F']
      ];

      if (!params.custpage_status_filter) {
      
        filters.push('AND', ['status', 'anyof', ['SalesOrd:B', 'SalesOrd:D', 'SalesOrd:E', 'SalesOrd:F']]);
      } else {
      
        filters.push('AND', ['status', 'anyof', params.custpage_status_filter]);
      }

      if (params.custpage_customer_filter) {
        filters.push('AND', ['entity', 'anyof', params.custpage_customer_filter]);
      }
      if (params.custpage_subsidiary_filter) {
        filters.push('AND', ['subsidiary', 'anyof', params.custpage_subsidiary_filter]);
      }
      if (params.custpage_department_filter) {
        filters.push('AND', ['department', 'anyof', params.custpage_department_filter]);
      }

      return filters;
    } catch (e) {
      log.error('buildSearchFilters Error', e);
      return [];
    }
  }

  /**
 * Executes a saved search for Sales Orders using the provided filters.
 * Returns grouped results with calculated subtotal, tax, and total amounts
 * converted based on currency exchange rates.
 *
 * @param {Array} filters - Array of search filter conditions
 * @returns {Array} results - Array of search results objects
 */


  function runSalesOrderSearch(filters) {
    try {
      const taxCol = search.createColumn({
        name: 'formulacurrency',
        summary: "MAX",
        formula: "{taxtotal} / {currency.exchangerate}",
        label: "ConvertedTax"
      });

      const totalCol = search.createColumn({
        name: 'formulacurrency',
        summary: "MAX",
        formula: "{totalamount} / {currency.exchangerate}",
        label: "ConvertedTotal"
      });

      const subtotalCol = search.createColumn({
        name: 'formulacurrency',
        summary: "SUM",
        formula: "{grossamount} / {currency.exchangerate}",
        label: "ConvertedSubtotal"
      });

      const soSearch = search.create({
        type: search.Type.SALES_ORDER,
        filters,
        columns: [
          search.createColumn({ name: "tranid", summary: "GROUP" }),
          search.createColumn({ name: "internalid", summary: "GROUP" }),
          search.createColumn({ name: "trandate", summary: "GROUP" }),
          search.createColumn({ name: "statusref", summary: "GROUP" }),
          search.createColumn({ name: "entity", summary: "GROUP" }),
          search.createColumn({ name: "subsidiary", summary: "GROUP" }),
          search.createColumn({ name: "department", summary: "GROUP" }),
          search.createColumn({ name: "class", summary: "GROUP" }),
          subtotalCol,
          taxCol,
          totalCol
        ]
      });

      const results = [];
      soSearch.run().each(result => { results.push(result); return true; });
      return results;
    } catch (e) {
      log.error('runSalesOrderSearch Error', e);
      return [];
    }
  }

  /**
 * Populates the given sublist with sales order search results.
 * Maps each result column to the corresponding sublist field and sets values safely.
 *
 * @param {serverWidget.Sublist} sublist - The sublist to populate with sales order data
 * @param {Array} results - Array of search result objects containing sales order details
 */


  function populateSublistWithResults(sublist, results) {
    try {
      results.forEach((result, line) => {
        const cols = result.columns;

        safeSet(sublist, { id: 'custpage_so_internalid', line, value: result.getValue(cols[1]) });
        safeSet(sublist, { id: 'custpage_so_tranid', line, value: result.getValue(cols[0]) });
        safeSet(sublist, { id: 'custpage_so_date', line, value: result.getValue(cols[2]) });
        safeSet(sublist, { id: 'custpage_so_status', line, value: result.getText(cols[3]) });
        safeSet(sublist, { id: 'custpage_so_customer', line, value: result.getText(cols[4]) });
        safeSet(sublist, { id: 'custpage_so_subsidiary', line, value: result.getText(cols[5]) });
        safeSet(sublist, { id: 'custpage_so_department', line, value: result.getText(cols[6]) });
        safeSet(sublist, { id: 'custpage_so_class', line, value: result.getText(cols[7]) });

        safeSet(sublist, { id: 'custpage_so_subtotal', line, value: result.getValue(cols[8]) || "0.00" });
        safeSet(sublist, { id: 'custpage_so_tax', line, value: result.getValue(cols[9]) || "0.00" });
        safeSet(sublist, { id: 'custpage_so_total', line, value: result.getValue(cols[10]) || "0.00" });
      });
    } catch (e) {
      log.error('populateSublistWithResults Error', e);
    }
  }

  /**
 * Safely sets a value in the given sublist field.
 * Wraps the set operation in a try/catch to log errors without breaking execution.
 *
 * @param {serverWidget.Sublist} sublist - The sublist object to update
 * @param {Object} options - Parameters for setting the sublist value
 * @param {string} options.id - The field ID in the sublist
 * @param {number} options.line - The line number in the sublist
 * @param {string|number} options.value - The value to set in the field
 */


  function safeSet(sublist, { id, line, value }) {
    try {
      sublist.setSublistValue({ id, line, value: String(value ?? '') });
    } catch (err) {
      log.error('safeSet failed', { fieldId: id, lineNumber: line, attemptedValue: value, error: err.message });
    }
  }

  return { onRequest };
});
