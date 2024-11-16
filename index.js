const express = require("express");
const app = express();
const bodyParser = require("body-parser");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

require("dotenv").config();
app.use(bodyParser.json());
const cors = require("cors");
const axios = require("axios");

app.listen(4000, () => {
  console.log("App is running on port 4000");
});

app.use(cors());

app.get("/", (req, res, next) => {
  return res.status(200).send({ message: "Hello jesse" });
});

app.get("/token", (req, res) => {
  generateToken();
});
const generateToken = async (req, res, next) => {
  const secretKey = process.env.SAFARICOM_CONSUMER_SECRET;
  const consumerKey = process.env.SAFARICOM_CONSUMER_KEY;
  const auth = new Buffer.from(`${consumerKey}:${secretKey}`).toString(
    "base64"
  );

  try {
    const response = await axios.get(
      "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
      {
        headers: {
          authorization: `Basic ${auth}`,
        },
      }
    );
    console.log(response.data.access_token);
    const token = response.data.access_token;
    req.token = token;
    next();
  } catch (e) {
    console.log(e);
  }
};

let CheckoutRequestID;
let timeStamp;
let password;

app.post("/stk", generateToken, async (req, res, next) => {
  const phone = req.body.phone.substring(1);
  const amount = req.body.amount;
  const date = new Date();
  timeStamp =
    date.getFullYear() +
    ("0" + (date.getMonth() + 1)).slice(-2) +
    ("0" + date.getDate()).slice(-2) +
    ("0" + date.getHours()).slice(-2) +
    ("0" + date.getMinutes()).slice(-2) +
    ("0" + date.getSeconds()).slice(-2);
  const shortCode = process.env.BUSINESS_SHORT_CODE;
  const passKey = process.env.PASS_KEY;
  password = new Buffer.from(shortCode + passKey + timeStamp).toString(
    "base64"
  );

  if (req.err) {
    console.log("Error while retrieving token:", req.err);
    return res.status(500).json({ error: "Error while retrieving token" });
  }
  const token = req.token;

  if (!token) {
    return res.status(400).json({ error: "Token not available" });
  }

  try {
    const response = await axios.post(
      "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
      {
        //MPESA PAYBILL FOR BUSINESS SHORTCODE
        BusinessShortCode: shortCode,
        Password: password,
        Timestamp: timeStamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: amount,
        PartyA: `254${phone}`,
        PartyB: shortCode,
        PhoneNumber: `254${phone}`,
        CallBackURL:
          "https://d00d-154-159-237-169.ngrok-free.app/api/callback-route",
        AccountReference: `Mlosafi`,
        TransactionDesc: "Mlosafi",
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    CheckoutRequestID = response.data.CheckoutRequestID;
    res.status(201).json({
      message: true,
      data: response.data,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "failed",
      error: error.message,
    });
  }
});

app.get("/get-specific-tx-detail", generateToken, async (req, res) => {
  try {
    if (!CheckoutRequestID) {
      return res.status(403).json({ error: "CheckoutRequestID not available" });
    }
    const shortCode = process.env.BUSINESS_SHORT_CODE;
    const passKey = process.env.PASS_KEY;
    const token = req.token;
    const response = await axios.post(
      "https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query",
      {
        BusinessShortCode: shortCode,
        Password: password,
        Timestamp: timeStamp,
        CheckoutRequestID: CheckoutRequestID,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Return the response to the client
    return res.status(200).json({ data: response.data });
  } catch (error) {
    console.error("Error processing callback:", error);
    return res.status(500).json({ status: "error", message: error.message });
  }
});

app.post("/api/callback-route", (req, res) => {
  try {
    const callbackData = req.body;
    console.log("Received Callback Data:", callbackData);

    if (callbackData.Body && callbackData.Body.stkCallback) {
      const { stkCallback } = callbackData.Body;
      console.log("STK Callback Details:", stkCallback);
    }

    res.json({
      status: "success",
      callbackData,
    });
  } catch (err) {
    console.error("Error processing callback:", err);
  }
});
