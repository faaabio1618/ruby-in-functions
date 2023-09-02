This is a stupid project to allow you to write Ruby code in Shopify Functions, it's just for fun.

# Ruby as first class... configuration

> &#x24D8; **Note**
>
> This is just a thing I thought it would be funny to make, it has 0 real use cases, but the real treasure is the
~~friends~~ knowledge we made along the way.

## Rationale

I don't like many thing of [Shopify Scripts](https://help.shopify.com/en/manual/checkout-settings/script-editor), but
one thing I love is that it allows an infinite level of customisation inside a very simple app.

[Shopify Functions](https://www.shopify.com/enterprise/shopify-functions) are great, but the deployment, even
with [simplified deployment](https://shopify.dev/docs/apps/deployment/extension/simplified), is cumbersome and requires
lots
of steps.

What if we could make a function that allow us to write a Shopify Script, and run it?

![Goal Plot](/tutorials/ruby-in-functions/fff.svg#centered)

## Translating Ruby into Javascript

With [Ruby2JS](https://www.ruby2js.com/) is super simple. We will write an AWS Lambda that just does that.

```ruby
require 'ruby2js' 

def handler(event:, context:)
  
  Ruby2JS.convert(event["body"], preset: true)
  
end
```

This is called (with a fetch call) when the function configuration is saved.

### Testing

```bash
$ curl -'https://lambdaid.lambda-url.eu-west-3.on.aws/' -H 'content-type: text/plain' -d 'puts "hi"'
console.log("hi")
```

Fantastic.

### Creating the extension

For the function we'll just follow
this [tutorial](https://shopify.dev/docs/apps/selling-strategies/discounts/experience#sample-code).

```bash

$ npm init @shopify/app@latest -- --template https://github.com/Shopify/function-examples/sample-apps/discounts
$ cd ruby-in-functions
$ yarn deploy
$ yarn dev

```

### Configuration Page

Now we just need to change the configuration page to allow us to write Ruby code, and then we'll translate it to JS when
it is submitted.

![Preview](/tutorials/ruby-in-functions/preview.png#centered)

We removed all the fields from the example and thanks
to [react-simple-code-editor](https://github.com/react-simple-code-editor/react-simple-code-editor)
and [prismjs](https://prismjs.com/) we added a simple code editor with Ruby syntax highlighting.

```jsx

<Editor
  value={script.value}
  onValueChange={script.onChange}
  highlight={code => highlight(code, languages.ruby, 'ruby')}
  padding={10}
  style={{
    fontFamily: '"Fira code", "Fira Mono", monospace',
    fontSize: 12,
  }}
/>
```

Now we just make sure we translate the code before saving it in a metaobject.

### Saving the configuration

We are saving the script in the configuration, and we are translating it to JS before saving it.

This is the ruby code we will use:

```ruby
# Use this script to offer a percentage discount that increases according to the total value of the items in their cart.

# For example, offer customers 10% off if they spend $30 or more, 15% off if they spend $50 or more.

SPENDING_THRESHOLDS = [
  {
    threshold: 30,
    discount_type: :percent,
    discount_amount: 10,
    discount_message: 'Spend $30 and get 10% off!',
  },
  {
    threshold: 50,
    discount_type: :percent,
    discount_amount: 15,
    discount_message: 'Spend $50 and get 15% off!',
  }
]
applicable_tier = SPENDING_THRESHOLDS.sort!{|a, b| a.discount_amount < b.discount_amount}.find { |tier| cart.subtotal_price >= (Money.new(cents: 100) * tier[:threshold]) }
Input.cart.line_items.each do |line_item|
  next if line_item.variant.product.gift_card?
  line_item.change_line_price(line_item.line_price * applicable_tier[:discount_amount], message: applicable_tier[:discount_message])
end
```

It's a simple tiered discount based on
the [Shopify examples](https://help.shopify.com/en/manual/checkout-settings/script-editor/examples/line-item-scripts#tiered-discount-by-spend)

This is the call and input to save the configuration:

```graphql
 mutation CreateAutomaticDiscount($discount: DiscountAutomaticAppInput!) {
  discountCreate:  discountAutomaticAppCreate(automaticAppDiscount: $discount) {
    userErrors {
      code
      message
      field
    }
  }
}
```

```jsx
{
  variables: {
    discount: {
    ...
      baseDiscount,
        combinesWith
    :
      {
      }
    ,
      endsAt: new Date("2024-12-31T23:59:59Z"),
        functionId
    :
      functionId,
        startsAt
    :
      new Date("2022-12-31T23:59:59Z"),
        title
    :
      "my-ruby-discount",
        metafields
    :
      [
        {
          namespace: "$app:ruby-in-functions",
          key: "function-configuration",
          type: "json",
          value: JSON.stringify({code: js_code}),
        },
      ],
    }
  ,
  }
,
}
```

### Tweaking Javascript

The function is **automatically** translated into this javascript code

```javascript
const SPENDING_THRESHOLDS = [
  {
    threshold: 30,
    discount_type: "percent",
    discount_amount: 10,
    discount_message: "Spend $30 and get 10% off!"
  },

  {
    threshold: 50,
    discount_type: "percent",
    discount_amount: 15,
    discount_message: "Spend $50 and get 15% off!"
  }
];

let applicable_tier = SPENDING_THRESHOLDS.sort((a, b) => (
  a.discount_amount < b.discount_amount
)).find(tier => (
  Input.cart.subtotal_price >= (new Money({cents: 100}) * tier.threshold)
));

for (let line_item of Input.cart.line_items) {
  if (line_item.variant.product.gift_card) continue;

  line_item.change_line_price(
    line_item.line_price * applicable_tier.discount_amount,
    {message: applicable_tier.discount_message}
  )
}
```

We will apply some tweaks to make it work and run it inside an `eval`. 
