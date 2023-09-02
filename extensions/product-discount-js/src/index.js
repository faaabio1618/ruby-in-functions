// @ts-check
import {DiscountApplicationStrategy} from "../generated/api";

/**
 * @typedef {import("../generated/api").InputQuery} InputQuery
 * @typedef {import("../generated/api").FunctionResult} FunctionResult
 * @typedef {import("../generated/api").Target} Target
 * @typedef {import("../generated/api").ProductVariant} ProductVariant
 */

/**
 * @type {FunctionResult}
 */
const EMPTY_DISCOUNT = {
  discountApplicationStrategy: DiscountApplicationStrategy.First,
  discounts: [],
};

export default /**
 * @param {InputQuery} input
 * @returns {FunctionResult}
 */
  (input) => {
  /**
   * @type {{
   *   code: string
   * }}
   */
  const configuration = JSON.parse(
    input?.discountNode?.metafield?.value ?? "{}"
  );
  if (!configuration.code) {
    return EMPTY_DISCOUNT;
  }
  let targets = [];
  let discountValue = {percentage: {value: 0}};
  let discount_message = "Applying ruby discounts";
  // console.log(JSON.stringify(input));
  const Input = {
    cart: {
      subtotal_price: input?.cart?.cost?.subtotalAmount.amount,
      line_items: input?.cart.lines.map(line_item => ({
        variant: {
          product: {
            gift_card: (line_item.merchandise.__typename !== "ProductVariant")
          }
        },
        change_line_price: (new_price, {message}) => {
          if (line_item.merchandise.__typename === "ProductVariant") {
            discount_message = message;
            targets.push({
              productVariant: {
                id: line_item.merchandise.id
              }
            })
          }
          discountValue = {
            percentage: {
              value: new_price / line_item.cost.totalAmount.amount
            }
          }
          return new_price;
        },
        line_price: line_item.cost.totalAmount.amount
      }))
    }
  }

  function Money({cents}) {
    this.cents = cents;
  }

  Money.prototype.valueOf = function () {
    return this.cents / 100;
  };

  eval(configuration.code);

  if (!targets.length) {
    console.error("No cart lines qualify for volume discount.");
    return EMPTY_DISCOUNT;
  }

  return {
    discounts: [
      {
        targets,
        value: discountValue,
        message: discount_message
      }
    ],
    discountApplicationStrategy: DiscountApplicationStrategy.Maximum
  };
};
