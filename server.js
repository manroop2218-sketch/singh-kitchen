const express = require('express');
const crypto = require('crypto');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const MENU = {
  'Breakfast': [20,30,40,50,20,10,20,30,30,50,10,40,25,40,30,20,80,80,80,30,40,50],
  'Snacks': [60,80,120,150,20,80,100,120,300,20,40,100,150,180,120,150,180,180,60,30,10,40,25,40],
  'Lunch & Dinner': [120,180],
  'Tea & Beverages': [20,30,30,80,40,20,80]
};
const DELIVERY_CHARGE = 50;

function calculateAmount(items) {
  if (!Array.isArray(items) || !items.length) throw new Error('No items selected');
  let total = 0;
  for (const item of items) {
    const prices = MENU[item.category];
    const index = Number(item.index);
    const quantity = Number(item.quantity);
    if (!prices || !Number.isInteger(index) || index < 0 || index >= prices.length || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      throw new Error('Invalid order item');
    }
    total += prices[index] * quantity;
  }
  return (total + DELIVERY_CHARGE) * 100;
}

app.post('/api/create-order', async (req, res) => {
  try {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) return res.status(500).json({error:'Razorpay is not configured on the server.'});
    const amount = calculateAmount(req.body.items);
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method:'POST',
      headers:{'Authorization':`Basic ${auth}`,'Content-Type':'application/json'},
      body:JSON.stringify({amount,currency:'INR',receipt:`SK-${Date.now()}`})
    });
    const data = await response.json();
    if (!response.ok) return res.status(502).json({error:data?.error?.description || 'Could not create Razorpay order'});
    res.json({order_id:data.id, amount:data.amount, currency:data.currency, key_id:keyId});
  } catch (e) { res.status(400).json({error:e.message || 'Could not create order'}); }
});

app.post('/api/verify-payment', (req, res) => {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return res.status(500).json({error:'Razorpay is not configured on the server.'});
  const {razorpay_order_id, razorpay_payment_id, razorpay_signature} = req.body || {};
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) return res.status(400).json({error:'Missing payment details'});
  const expected = crypto.createHmac('sha256', secret).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest('hex');
  const a = Buffer.from(expected, 'utf8'), b = Buffer.from(String(razorpay_signature), 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a,b)) return res.status(400).json({error:'Payment signature verification failed'});
  res.json({success:true, payment_id:razorpay_payment_id});
});

app.get('*', (req,res) => res.sendFile(path.join(__dirname,'public','index.html')));
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Singh Kitchen running on port ${port}`));
