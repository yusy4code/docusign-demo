const docusign = require("docusign-esign"),
  path = require("path"),
  fs = require("fs"),
  process = require("process"),
  { promisify } = require("util"), // http://2ality.com/2017/05/util-promisify.html
  basePath = "https://demo.docusign.net/restapi",
  express = require("express"),
  envir = process.env;
  require('dot-env');
  moment = require('moment');
  num2Words = require('num-words');

const accessToken = envir.ACCESS_TOKEN;
const accountId   = envir.ACCOUNT_ID;

const app = express();
app.set("view engine", "ejs");

app.get("/", (req, res) => {
  console.log(req.query.USER_FULLNAME);
  res.render("index");
});

app.get("/dsreturn", (req, res) => {
  res.redirect("/");
});

app.get("/signTemp", async (req, res) => {
  let baseUrl = envir.BASE_URL || "http://localhost:3000";

  const qp = req.query;
  console.log(qp);

  const signerName = envir.USER_FULLNAME || qp.USER_FULLNAME || "John Signer";
  const signerEmail =
    envir.USER_EMAIL || qp.USER_EMAIL || "john.signer@example.com";
  const receiptNumber = qp.RECEIPT_NUMBER || "INV_123123123";
  const commAmount = qp.AMOUNT || "100";
  const phoneNumber = qp.PHONE_NUMBER || "9876543210";
  const amountInWords = num2Words(commAmount)


  const clientUserId = "123", // Used to indicate that the signer will use an embedded
    // Signing Ceremony. Represents the signer's userId within
    // your application.
    authenticationMethod = "None"; // How is this application authenticating
  // the signer? See the `authenticationMethod' definition
  // https://developers.docusign.com/esign-rest-api/reference/Envelopes/EnvelopeViews/createRecipient

  console.log("step1: creating envelop");

  let envDef = docusign.EnvelopeDefinition.constructFromObject({
    templateId: envir.TEMPLATE_ID,
    status: "sent"
  });

  let receiptNumberText = docusign.Text.constructFromObject({
    tabLabel: "receiptNumber",
    bold: "true",
    value: receiptNumber,
    locked: "true"
  });

  let amountText = docusign.Text.constructFromObject({
    tabLabel: "amountText",
    bold: "true",
    value: commAmount,
    locked: "true"
  });

  let textSignDate = docusign.Text.constructFromObject({
    tabLabel: "dateText",
    value: moment().format('DD MMMM YYYY'),
    locked: "true"
  });
  let phoneText = docusign.Text.constructFromObject({
    tabLabel: "phoneText",
    value: phoneNumber,
    locked: "false"
  });

  let textAmountInWords = docusign.Text.constructFromObject({
    tabLabel: "amountWordsText",
    value: amountInWords,
    locked: "true"
  });

  let emailText = docusign.Text.constructFromObject({
    tabLabel: "emailText",
    value: signerEmail,
    locked: "false"
  });

  let tabs = docusign.Tabs.constructFromObject({
    textTabs: [
      receiptNumberText,
      amountText,
      textSignDate,
      phoneText,
      textAmountInWords,
      emailText
    ]
  });

  // Create the signer object with the previously provided name / email address
  const tourLeader = docusign.TemplateRole.constructFromObject({
    name: signerName,
    email: signerEmail,
    roleName: "Tour Lead",
    routingOrder: "1",
    recipientId: "1",
    clientUserId: clientUserId,
    tabs: tabs
  });


  envDef.templateRoles = [tourLeader];

  /**
   *  Step 2. Create/send the envelope.
   *          We're using a promise version of the SDK's createEnvelope method.
   */
  console.log("step2: send envelop");
  const apiClient = new docusign.ApiClient();
  apiClient.setBasePath(basePath);
  apiClient.addDefaultHeader("Authorization", "Bearer " + accessToken);
  // Set the DocuSign SDK components to use the apiClient object
  docusign.Configuration.default.setDefaultApiClient(apiClient);
  let envelopesApi = new docusign.EnvelopesApi(),
    // createEnvelopePromise returns a promise with the results:
    createEnvelopePromise = promisify(envelopesApi.createEnvelope).bind(
      envelopesApi
    ); //,results;

  try {
    results = await createEnvelopePromise(accountId, {
      envelopeDefinition: envDef
    });

    /**
     * Step 3. The envelope has been created.
     *         Request a Recipient View URL (the Signing Ceremony URL)
     */
    console.log("Step3: envelop created");
    const envelopeId = results.envelopeId,
      recipientViewRequest = docusign.RecipientViewRequest.constructFromObject({
        authenticationMethod: authenticationMethod,
        clientUserId: clientUserId,
        recipientId: "1",
        returnUrl: baseUrl + "/dsreturn",
        userName: signerName,
        email: signerEmail
      });
    const createRecipientViewPromise = promisify(
      envelopesApi.createRecipientView
    ).bind(envelopesApi);

    console.log("Step4: wait for receipients view");
    results = await createRecipientViewPromise(accountId, envelopeId, {
      recipientViewRequest: recipientViewRequest
    });
    /**
     * Step 4. The Recipient View URL (the Signing Ceremony URL) has been received.
     *         Redirect the user's browser to it.
     */
    res.redirect(results.url);
    console.log("Step5: View completed");
  } catch (e) {
    // Handle exceptions
    let body = e.response && e.response.body;
    if (body) {
      // DocuSign API exception
      res.send(`<html lang="en"><body>
                  <h3>API problem</h3><p>Status code ${e.response.status}</p>
                  <p>Error message:</p><p><pre><code>${JSON.stringify(
                    body,
                    null,
                    4
                  )}</code></pre></p>`);
    } else {
      // Not a DocuSign exception
      throw e;
    }
  }
});


app.listen(3000, () => {
  console.log(`server started at 3000`);
});
