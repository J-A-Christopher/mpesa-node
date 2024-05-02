const express = require("express");

const app = express();

require("dotenv").config();
const cors = require("cors");
const axios = require("axios");

app.listen(3000, () => {
  console.log("App is running on port 3000");
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

app.get("/home", (req, res, next) => {
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

app.post("/stk", generateToken, async (req, res, next) => {
  const phone = req.body.phone.substring(1);
  const amount = req.body.amount;
  const date = new Date();
  const timeStamp =
    date.getFullYear() +
    ("0" + (date.getMonth() + 1)).slice(-2) +
    ("0" + date.getDate()).slice(-2) +
    ("0" + date.getHours()).slice(-2) +
    ("0" + date.getMinutes()).slice(-2) +
    ("0" + date.getSeconds()).slice(-2);
  const shortCode = process.env.BUSINESS_SHORT_CODE;
  const passKey = process.env.PASS_KEY;
  const password = new Buffer.from(shortCode + passKey + timeStamp).toString(
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

  await axios
    .post(
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
        CallBackURL: "https://f172-105-161-112-136.ngrok-free.app/callback",
        //CallBackURL: "https://mydomain.com/pat",
        AccountReference: `Mlosafi`,
        TransactionDesc: "Mlosafi",
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )
    .then((data) => {
      res.status(200).json(data.data);
    })
    .catch((err) => {
      console.log(err.message);
      res.status(400).json(err.message);
    });
});

app.post("/callback", (req, res) => {
  console.log("In callback");
  const callbackData = req.body;
  console.log("Callback data is", callbackData);
});
