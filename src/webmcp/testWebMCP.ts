/**
 * In-browser & Automated WebMCP Test Suite
 * Validates all 10 scenarios specified in Phase 6:
 *  1. Search for a product through an AI agent.
 *  2. Retrieve product details.
 *  3. Filter products by price and category.
 *  4. Add a selected product to the cart after confirmation.
 *  5. Retrieve cart details.
 *  6. Update cart quantity.
 *  7. Remove a product.
 *  8. Apply a coupon (handling unavailable backend API safely).
 *  9. Initiate checkout safely (no automatic payments).
 * 10. Test API errors and unauthorized/malformed requests.
 */

import { webMCPRegistry } from './registry';

export interface TestResult {
  scenario: number;
  name: string;
  passed: boolean;
  output: any;
  error?: string;
}

export async function runWebMCPScenarios(): Promise<{
  total: number;
  passed: number;
  failed: number;
  results: TestResult[];
}> {
  const results: TestResult[] = [];
  const logScenario = (scenario: number, name: string, passed: boolean, output: any, error?: string) => {
    results.push({ scenario, name, passed, output, error });
    const mark = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`[WebMCP Test] ${mark} - Scenario ${scenario}: ${name}`);
    if (error) console.error(`  Error details:`, error);
  };

  console.log('--- Starting WebMCP Integration Test Suite (10 Scenarios) ---');

  // Scenario 1: Search for a product through an AI agent
  try {
    const res = await webMCPRegistry.executeTool('search_products', { query: 'cotton', limit: 5 });
    const passed = Array.isArray(res?.products) && res?.totalMatches !== undefined;
    logScenario(1, 'Search for a product through an AI agent', passed, res);
  } catch (err: any) {
    logScenario(1, 'Search for a product through an AI agent', false, null, err.message);
  }

  // Scenario 2: Retrieve product details
  try {
    const res = await webMCPRegistry.executeTool('get_product_details', { productId: 1 });
    const passed = (res?.found === true && res?.product?.id === 1) || (res?.found === false);
    logScenario(2, 'Retrieve product details', passed, res);
  } catch (err: any) {
    logScenario(2, 'Retrieve product details', false, null, err.message);
  }

  // Scenario 3: Filter products by price and category
  try {
    const res = await webMCPRegistry.executeTool('filter_products', {
      category: "men's clothing",
      minPrice: 10,
      maxPrice: 200,
      minRating: 3,
    });
    const passed = Array.isArray(res?.products) && res?.appliedFilters !== undefined;
    logScenario(3, 'Filter products by price and category', passed, res);
  } catch (err: any) {
    logScenario(3, 'Filter products by price and category', false, null, err.message);
  }

  // Scenario 4: Add a selected product to the cart after confirmation
  try {
    // 4a. Without confirmation -> must ask for confirmation
    const preConfirmRes = await webMCPRegistry.executeTool('add_to_cart', {
      productId: 1,
      quantity: 2,
      confirmed: false,
    });
    const asksConfirmation = preConfirmRes?.requiresConfirmation === true;

    // 4b. With confirmation -> should succeed
    const postConfirmRes = await webMCPRegistry.executeTool('add_to_cart', {
      productId: 1,
      quantity: 2,
      confirmed: true,
    });
    const addedSuccessfully = postConfirmRes?.success === true && postConfirmRes?.addedItem?.quantity === 2;

    const passed = asksConfirmation && addedSuccessfully;
    logScenario(4, 'Add a selected product to the cart after confirmation', passed, {
      preConfirmation: preConfirmRes,
      postConfirmation: postConfirmRes,
    });
  } catch (err: any) {
    logScenario(4, 'Add a selected product to the cart after confirmation', false, null, err.message);
  }

  // Scenario 5: Retrieve cart details
  try {
    const res = await webMCPRegistry.executeTool('get_cart');
    const passed = typeof res?.itemCount === 'number' && typeof res?.totalAmount === 'number' && Array.isArray(res?.items);
    logScenario(5, 'Retrieve cart details', passed, res);
  } catch (err: any) {
    logScenario(5, 'Retrieve cart details', false, null, err.message);
  }

  // Scenario 6: Update cart quantity
  try {
    const res = await webMCPRegistry.executeTool('update_cart', { productId: 1, quantity: 4 });
    const passed = res?.success === true && res?.newQuantity === 4;
    logScenario(6, 'Update cart quantity', passed, res);
  } catch (err: any) {
    logScenario(6, 'Update cart quantity', false, null, err.message);
  }

  // Scenario 7: Remove a product
  try {
    const res = await webMCPRegistry.executeTool('remove_from_cart', { productId: 1 });
    const passed = res?.success === true && res?.removedProduct?.id === 1;
    logScenario(7, 'Remove a product', passed, res);
  } catch (err: any) {
    logScenario(7, 'Remove a product', false, null, err.message);
  }

  // Scenario 8: Apply a coupon
  try {
    const res = await webMCPRegistry.executeTool('apply_coupon', { code: 'SAVE20' });
    const passed = res?.applied === false && res?.status === 'UNAVAILABLE' && res?.code === 'SAVE20';
    logScenario(8, 'Apply a coupon (proper UNAVAILABLE API status)', passed, res);
  } catch (err: any) {
    logScenario(8, 'Apply a coupon', false, null, err.message);
  }

  // Scenario 9: Initiate checkout safely
  try {
    // 9a. Test empty cart
    const emptyCartRes = await webMCPRegistry.executeTool('start_checkout', { confirmed: true });
    const emptyHandled = emptyCartRes?.status === 'CART_EMPTY';

    // Add item for checkout test
    await webMCPRegistry.executeTool('add_to_cart', { productId: 2, quantity: 1, confirmed: true });

    // 9b. Without confirmation -> must prompt confirmation
    const unconfirmedRes = await webMCPRegistry.executeTool('start_checkout', { confirmed: false });
    const asksConfirmation = unconfirmedRes?.requiresConfirmation === true;

    // 9c. With confirmation -> starts checkout without charging automatic payments
    const confirmedRes = await webMCPRegistry.executeTool('start_checkout', { confirmed: true });
    const checkoutReady = confirmedRes?.status === 'CHECKOUT_READY' && confirmedRes?.securityNotice !== undefined;

    const passed = emptyHandled && asksConfirmation && checkoutReady;
    logScenario(9, 'Initiate checkout safely without automatic payment execution', passed, {
      emptyCartRes,
      unconfirmedRes,
      confirmedRes,
    });
  } catch (err: any) {
    logScenario(9, 'Initiate checkout safely', false, null, err.message);
  }

  // Scenario 10: Test API errors and unauthorized/malformed requests
  try {
    // 10a. Missing required param
    const missingParam = await webMCPRegistry.executeTool('search_products', { query: '' });
    const errMissing = missingParam?.error === true;

    // 10b. Invalid product ID
    const invalidId = await webMCPRegistry.executeTool('get_product_details', { productId: -99 });
    const errInvalidId = invalidId?.error === true;

    // 10c. Inverted price range
    const invalidRange = await webMCPRegistry.executeTool('filter_products', { minPrice: 500, maxPrice: 100 });
    const errInvalidRange = invalidRange?.error === true;

    // 10d. Non-existent tool call
    let errNonExistent = false;
    try {
      await webMCPRegistry.executeTool('non_existent_tool', {});
    } catch {
      errNonExistent = true;
    }

    const passed = errMissing && errInvalidId && errInvalidRange && errNonExistent;
    logScenario(10, 'Test API errors and unauthorized requests', passed, {
      errMissing,
      errInvalidId,
      errInvalidRange,
      errNonExistent,
    });
  } catch (err: any) {
    logScenario(10, 'Test API errors and unauthorized requests', false, null, err.message);
  }

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.length - passedCount;

  console.log(`--- WebMCP Test Suite Complete: ${passedCount}/${results.length} Scenarios Passed ---`);

  return {
    total: results.length,
    passed: passedCount,
    failed: failedCount,
    results,
  };
}

// Bind to window for direct browser console testing
if (typeof window !== 'undefined') {
  (window as any).runWebMCPScenarios = runWebMCPScenarios;
}

