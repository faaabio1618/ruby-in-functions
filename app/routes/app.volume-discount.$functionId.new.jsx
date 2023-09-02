import {useEffect} from "react";
import {useField, useForm} from "@shopify/react-form";
import {highlight, languages} from 'prismjs/components/prism-core';
import "prismjs/components/prism-clike";
import "prismjs/components/prism-ruby";
import {useAppBridge} from "@shopify/app-bridge-react";
import {Redirect} from "@shopify/app-bridge/actions";
import {Form, useActionData, useNavigation, useSubmit,} from "@remix-run/react";
import {onBreadcrumbAction,} from "@shopify/discount-app-components";
import {Banner, Card, Layout, LegacyCard, Page, PageActions, VerticalStack,} from "@shopify/polaris";

import shopify from "../shopify.server";
import Editor from "react-simple-code-editor";
import {json} from "@remix-run/node";

export const action = async ({params, request}) => {
  const formData = await request.formData();
  const {functionId} = params;
  const {admin} = await shopify.authenticate.admin(request);
  const url = process.env.LAMBDA_URL || "https://process.env.LAMBDA_URL.not.found";
  const {
    script
  } = JSON.parse(formData.get("discount"));
  // POST REQUEST
  const js_code = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain'
    },
    body: script
  }).then(response => response.text());
  const baseDiscount = {
    functionId,
  };

  const response = await admin.graphql(
      `#graphql
    mutation CreateAutomaticDiscount($discount: DiscountAutomaticAppInput!) {
      discountCreate:  discountAutomaticAppCreate(automaticAppDiscount: $discount) {
        userErrors {
          code
          message
          field
        }
      }
    }`,
    {
      variables: {
        discount: {
          ...baseDiscount,
          combinesWith: {},
          endsAt: new Date("2024-12-31T23:59:59Z"),
          functionId: functionId,
          startsAt: new Date("2022-12-31T23:59:59Z"),
          title: "my-ruby-discount",
          metafields: [
            {
              namespace: "$app:ruby-in-functions",
              key: "function-configuration",
              type: "json",
              value: JSON.stringify({
                code: js_code,
              }),
            },
          ],
        },
      },
    }
  );

  const responseJson = await response.json();
  const errors = responseJson.data.discountCreate?.userErrors;
  return json({errors});

};

// This is the React component for the page.
export default function VolumeNew() {
  const submitForm = useSubmit();
  const actionData = useActionData();
  const navigation = useNavigation();
  const app = useAppBridge();

  const isLoading = navigation.state === "submitting";
  const submitErrors = actionData?.errors || [];
  const redirect = Redirect.create(app);

  useEffect(() => {
    if (actionData?.errors.length === 0) {
      redirect.dispatch(Redirect.Action.ADMIN_SECTION, {
        name: Redirect.ResourceType.Discount,
      });
    }
  }, [actionData]);

  const {
    fields: {
      script,
    },
    submit,
  } = useForm({
    fields: {
      script: useField("")
    },
    onSubmit: async (form) => {
      const discount = {
        script: form.script
      };

      submitForm({discount: JSON.stringify(discount)}, {method: "post"});

      return {status: "success"};
    },
  });

  const errorBanner =
    submitErrors.length > 0 ? (
      <Layout.Section>
        <Banner status="critical">
          <p>There were some issues with your form submission:</p>
          <ul>
            {submitErrors.map(({message, field}, index) => {
              return (
                <li key={`${message}${index}`}>
                  {field.join(".")} {message}
                </li>
              );
            })}
          </ul>
        </Banner>
      </Layout.Section>
    ) : null;

  return (
    // Render a discount form using Polaris components and the discount app components
    <Page
      title="Create your discount"
      backAction={{
        content: "Discounts",
        onAction: () => onBreadcrumbAction(redirect, true),
      }}
    >
      <Layout>
        {errorBanner}
        <Layout.Section>
          <Form method="post">
            <VerticalStack align="space-around" gap="2">
              <LegacyCard title={"Script"}>
                <LegacyCard.Section>
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
                </LegacyCard.Section>
              </LegacyCard>

            </VerticalStack>
          </Form>
        </Layout.Section>
        <Layout.Section secondary>
          <Card>
            Write your Ruby code as if you were writing a Shopify Script
          </Card>
        </Layout.Section>
        <Layout.Section>
          <PageActions
            primaryAction={{
              content: "Save discount",
              onAction: submit,
              loading: isLoading,
            }}
            secondaryActions={[
              {
                content: "Discard",
                onAction: () => onBreadcrumbAction(redirect, true),
              },
            ]}
          />
        </Layout.Section>
      </Layout>
    </Page>
  );
};

