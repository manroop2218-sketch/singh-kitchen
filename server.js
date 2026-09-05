const express = require('express');
const path = require('path');
const QRCode = require('qrcode');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const UPI_ID = 'dheerajdhot-hotmail.com@okhdfcbank';
const PAYEE_NAME = 'Singh Kitchen';

app.get('/api/upi-qr', async (req, res) => {
  try {
    const amount = Number(req.query.amount);
    if (!Number.isFinite(amount) || amount < 1 || amount > 100000) {
      return res.status(400).send('Invalid amount');
    }
    const params = new URLSearchParams({
      pa: UPI_ID,
      pn: PAYEE_NAME,
      am: amount.toFixed(2),
      cu: 'INR',
      tn: 'Singh Kitchen food order'
    });
    const upiUri = `upi://pay?${params.toString()}`;
    const svg = await QRCode.toString(upiUri, {type:'svg', margin:2, width:320, errorCorrectionLevel:'M'});
    res.type('image/svg+xml').send(svg);
  } catch (e) {
    res.status(500).send('Could not generate QR code');
  }
});

app.get('/health', (req,res) => res.status(200).send('OK'));
app.get('*', (req,res) => res.sendFile(path.join(__dirname,'public','index.html')));

const port = process.env.PORT || 3000;
app.listen(port, '0.0.0.0', () => console.log(`Singh Kitchen running on port ${port}`));
