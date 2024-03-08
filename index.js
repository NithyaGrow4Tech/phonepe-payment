const express = require("express");
const axios = require("axios");
const port = 4006;
const app = express();
const uniqid = require("uniqid");
const sha256 = require("sha256");


const mongoose = require('mongoose');
const Payment = require('./payment'); // Import Payment schema

//testing purpose
const PHONE_PAY_URL = "https://api-preprod.phonepe.com/apis/pg-sandbox";
const MERCHANT_ID = "PGTESTPAYUAT";
const SALT_INDEX = 1;
const SALT_KEY = "099eb0cd-02cf-4e2a-8aca-3e6c6aff0399";

app.get("/", (req, res) => {
    res.send("yeah finnally it is working");
});


app.get("/pay", (req, res) => {
    const payEndpoint = "/pg/v1/pay";
    const merchantTransactionId = uniqid();
    const userID = 123;
    const payload = (
        {
            merchantId: MERCHANT_ID,
            merchantTransactionId: merchantTransactionId,
            merchantUserId: userID,
            amount: 10000,
            redirectUrl: `https://localhost:4005/redirect-url/${merchantTransactionId}`,
            redirectMode: "REDIRECT",
            mobileNumber: "9999999999",
            paymentInstrument: {
                type: "PAY_PAGE"
            },
        }
    );
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
            res.redirect(url)
        })
        .catch(function (error) {
            console.error(error);
        });
});

app.get("/redirectUrl/:merchantTransactionId", (req, res) => {
    const { merchantTransactionId } = req.params;
    console.log("merchantTransactionId", merchantTransactionId);
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
                    // Payment is successful, store payment data
                    const payment = new Payment({
                        merchantTransactionId,
                        userId: '123', // Replace with actual user ID (e.g., from authentication)
                        amount: 10000, // Replace with the actual payment amount
                        status: 'success' // Set the payment status to 'success'
                    });

                    // Save the payment data to the database
                    payment.save()
                        .then(savedPayment => {
                            console.log('Payment data saved:', savedPayment);
                            // Redirect the user to the success page
                            res.redirect('/success');
                        })
                        .catch(error => {
                            console.error('Error saving payment data:', error);
                            // Redirect the user to the error page
                            res.redirect('/error');
                        });
                } else if (response.data.code === 'PAYMENT_ERROR') {
                    // Payment encountered an error, redirect the user to the error page
                    res.redirect('/error');
                } else {
                    // Payment is pending, redirect the user to the pending page
                    res.redirect('/pending');
                }

                res.send(response.data)
            })
            .catch(function (error) {
                console.error(error);
            });

    } else {
        res.send({ error: "Error" });
    }
});



app.listen(port, () => {
    console.log(`app starte ${port}`);
}); 
