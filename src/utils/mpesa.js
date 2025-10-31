const axios = require('axios');

class MPesa {
  constructor() {
    this.consumerKey = process.env.MPESA_CONSUMER_KEY;
    this.consumerSecret = process.env.MPESA_CONSUMER_SECRET;
    this.passkey = process.env.MPESA_PASSKEY;
    this.shortcode = process.env.MPESA_SHORTCODE;
    this.baseURL = process.env.MPESA_BASE_URL;
  }

  async generateToken() {
    const auth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');
    try {
      const response = await axios.get(`${this.baseURL}/oauth/v1/generate?grant_type=client_credentials`, {
        headers: {
          Authorization: `Basic ${auth}`,
        },
      });
      return response.data.access_token;
    } catch (error) {
      throw new Error('Failed to generate access token');
    }
  }

  async initiateSTKPush(phoneNumber, amount, orderId) {
    try {
      const token = await this.generateToken();
      const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
      const password = Buffer.from(
        `${this.shortcode}${this.passkey}${timestamp}`
      ).toString('base64');

      const response = await axios.post(
        `${this.baseURL}/mpesa/stkpush/v1/processrequest`,
        {
          BusinessShortCode: this.shortcode,
          Password: password,
          Timestamp: timestamp,
          TransactionType: 'CustomerPayBillOnline',
          Amount: Math.round(amount),
          PartyA: phoneNumber,
          PartyB: this.shortcode,
          PhoneNumber: phoneNumber,
          CallBackURL: `${process.env.BASE_URL}/api/payment/callback`,
          AccountReference: orderId,
          TransactionDesc: 'MC-Aid Marketplace Purchase'
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return response.data;
    } catch (error) {
      throw new Error('Failed to initiate payment');
    }
  }

  async validatePaymentCallback(data) {
    // Validate the callback data from M-Pesa
    const {
      MerchantRequestID,
      CheckoutRequestID,
      ResultCode,
      ResultDesc,
      CallbackMetadata,
    } = data.Body.stkCallback;

    if (ResultCode !== 0) {
      throw new Error(ResultDesc);
    }

    const paymentData = {};
    CallbackMetadata.Item.forEach((item) => {
      paymentData[item.Name] = item.Value;
    });

    return {
      merchantRequestId: MerchantRequestID,
      checkoutRequestId: CheckoutRequestID,
      amount: paymentData.Amount,
      mpesaReceiptNumber: paymentData.MpesaReceiptNumber,
      transactionDate: paymentData.TransactionDate,
      phoneNumber: paymentData.PhoneNumber,
    };
  }
}

module.exports = new MPesa();