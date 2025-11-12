/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */

/************************************************************************************************ 
 *  
 * OTP-9708 : Restrict IF save
 * 
************************************************************************************************* 
 * 
 * Author: Jobin and Jismi IT Services 
 * 
 * Date Created : 28-October-2025 P
 * 
 * Description : Restricts Item Fulfillment from UI unless the linked Sales Order has deposits covering or exceeding 
 *               its total.
 * 
 * REVISION HISTORY
 *
 * @version 1.0 : 28-October-2025 : Initial version created by JJ0418
 * 
*************************************************************************************************/

define(['N/record', 'N/runtime', 'N/search'],
    /**
     * @param {record} record
     * @param {runtime} runtime
     * @param {search} search
     */
    (record, runtime, search) => {

        /**
         * Executes before a record is submitted. Blocks fulfillment creation from UI if deposit is insufficient.
         *
         * @param {Object} scriptContext - Context object for the User Event.
         * @param {Record} scriptContext.newRecord - The new Item Fulfillment record.
         * @param {Record} scriptContext.oldRecord - The previous version of the record.
         * @param {string} scriptContext.type - Operation type (CREATE, EDIT, DELETE, etc.).
         * @returns {void}
         * @throws {Error} If deposit is less than Sales Order total.
         */
        const beforeSubmit = (scriptContext) => {
            try {
                const execContext = runtime.executionContext;

                // Only proceed if triggered from UI and during record creation
                if (execContext !== runtime.ContextType.USER_INTERFACE) {
                    log.debug('Exit', 'Execution context is not UI.');
                    return;
                }

                if (scriptContext.type !== scriptContext.UserEventType.CREATE) {
                    log.debug('Exit', 'Not a Create operation.');
                    return;
                }

                const newRecord = scriptContext.newRecord;
                const salesOrderId = newRecord.getValue({ fieldId: 'createdfrom' });

                if (!salesOrderId) {
                    log.debug('Skip', 'No Sales Order linked.');
                    return;
                }

                const salesOrder = record.load({
                    type: record.Type.SALES_ORDER,
                    id: salesOrderId,
                    isDynamic: false
                });

                const soStatus = salesOrder.getText({ fieldId: 'status' });
                const soTotal = parseFloat(salesOrder.getValue({ fieldId: 'total' })) || 0;

                if (soStatus !== 'Pending Fulfillment') {
                    log.debug('Skip', `Sales Order ${salesOrderId} status is not Pending Fulfillment.`);
                    return;
                }

                const depositTotal = getCustomerDepositTotal(salesOrderId);

                log.debug({
                    title: 'Deposit Validation',
                    details: `Sales Order ID: ${salesOrderId} | SO Total: ₹${soTotal} | Deposit Total: ₹${depositTotal}`
                });

                if (depositTotal < soTotal) {
                    throw new Error(
                        `Deposit ₹${depositTotal.toFixed(2)} is less than Sales Order total ₹${soTotal.toFixed(2)}. Fulfillment blocked.`
                    );
                }

            } catch (e) {
                log.error('Error in beforeSubmit', e);
                throw e;
            }
        };

        /**
         * Calculates the total deposit amount linked to a Sales Order.
         *
         * @param {number|string} salesOrderId - Internal ID of the Sales Order.
         * @returns {number} Total deposit amount.
         */
        function getCustomerDepositTotal(salesOrderId) {
            try {
                const depositSearch = search.create({
                    type: search.Type.CUSTOMER_DEPOSIT,
                    filters: [
                        ['createdfrom', 'anyof', salesOrderId],
                        'AND',
                        ['mainline', 'is', 'T']
                    ],
                    columns: ['total']
                });

                let depositTotal = 0;

                depositSearch.run().each(result => {
                    const amount = parseFloat(result.getValue('total'));
                    if (!isNaN(amount)) {
                        depositTotal += amount;
                    }
                    return true;
                });

                return depositTotal;

            } catch (e) {
                log.error('Error in getCustomerDepositTotal', e);
                return 0;
            }
        }

        return { beforeSubmit };
    });
