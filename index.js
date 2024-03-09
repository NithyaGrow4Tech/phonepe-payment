const express = require("express");
const axios = require("axios");
const port = 4006;
const app = express();
const uniqid = require("uniqid");
const sha256 = require("sha256");

const mongoose = require('mongoose');
const Payment = require('./payment'); // Import the Payment model correctly

// connect to the mongodb
mongoose.connect("mongodb+srv://admin:0987612345@admin.ufv8rfz.mongodb.net/phonepe")
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));

// it is for testing purpose
const PHONE_PAY_URL = "https://api-preprod.phonepe.com/apis/pg-sandbox";
const MERCHANT_ID = "PGTESTPAYUAT";
const SALT_INDEX = 1;
const SALT_KEY = "099eb0cd-02cf-4e2a-8aca-3e6c6aff0399";

// this is route for homepage
app.get("/", (req, res) => {
    res.send("Homepage - It's working!");
});

// it's the route to initiate the payment
app.get("/pay", (req, res) => {
    const payEndpoint = "/pg/v1/pay";
    const merchantTransactionId = uniqid();
    const userID = 123;
    const payload = {
        merchantId: MERCHANT_ID,
        merchantTransactionId: merchantTransactionId,
        merchantUserId: userID,
        amount: 10000,
        redirectUrl: `https://localhost:4006/redirect-url/${merchantTransactionId}`,
        redirectMode: "REDIRECT",
        mobileNumber: "9999999999",
        paymentInstrument: {
            type: "PAY_PAGE"
        },
    };
    const bufferObj = Buffer.from(JSON.stringify(payload), "utf8");
    const base63EncodedPayload = bufferObj.toString("base64");
    const xVerify = sha256(base63EncodedPayload + payEndpoint + SALT_KEY) + "###" + SALT_INDEX;

    const options = {
        method: "post",
        url: `${PHONE_PAY_URL}${payEndpoint}`,
        headers: {
            accept: "application/json",
            "Content-Type": "application/json",
            "X-VERIFY": xVerify,
        },
        data: {
            request: base63EncodedPayload,
        },
    };
    axios
        .request(options)
        .then(function (response) {
            console.log(response.data);
            const url = response.data.data.instrumentResponse.redirectInfo.url;
            res.redirect(url);
        })
        .catch(function (error) {
            console.error(error);
        });
});

// Route to handle redirect URL after payment
app.get("/redirectUrl/:merchantTransactionId", (req, res) => {
    const { merchantTransactionId } = req.params;
    if (merchantTransactionId) {
        const xVerify = sha256(`/pg/v1/status/${MERCHANT_ID}/${merchantTransactionId}` + SALT_KEY) + "###" + SALT_INDEX;
        const options = {
            method: "get",
            url: `${PHONE_PAY_URL}/pg/v1/status/${MERCHANT_ID}/${merchantTransactionId}`,
            headers: {
                accept: "application/json",
                "Content-Type": "application/json",
                "X-MERCHANT-ID": merchantTransactionId,
                "X-VERIFY": xVerify
            },
        };
        axios
            .request(options)
            .then(function (response) {
                console.log(response.data);
                if (response.data.code === 'PAYMENT_SUCCESS') {
                    const payment = new Payment({
                        merchantTransactionId,
                        userId: '123', // replace with actual userId
                        amount: 10000, // replace with the actual payment amount
                        status: 'success' // Set the payment status to 'success'
                    });

                    // Save the payment data to the database
                    payment.save()
                        .then(savedPayment => {
                            console.log('Payment data saved:', savedPayment);
                            res.redirect('/success');
                        })
                        .catch(error => {
                            console.error('Error saving payment data:', error); // Log the error
                            res.redirect('/error');
                        });
                } else if (response.data.code === 'PAYMENT_ERROR') {
                    res.redirect('/error');
                } else {
                    res.redirect('/pending');
                }
            })
            .catch(function (error) {
                console.error('Error fetching payment status:', error); // Log the error
                res.redirect('/error');
            });
    } else {
        res.send({ error: "Error" });
    }
});

//  this is for API endpoint to fetch all transactions
app.get("/transactions", (req, res) => {
    Payment.find({}, (err, transactions) => {
        if (err) {
            console.error('Error fetching transactions:', err);
            res.status(500).json({ error: 'Internal server error' });
        } else {
            res.json(transactions);
        }
    });
});

// Start the server
app.listen(port, () => {
    console.log(`Server started on port ${port}`);
});
