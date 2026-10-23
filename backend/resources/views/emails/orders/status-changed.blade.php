<!doctype html>
<html lang="en">
<body style="margin:0;padding:28px;background:#f3f4f6;color:#17212b;font-family:Arial,sans-serif;">
  <main style="max-width:620px;margin:0 auto;padding:28px;background:#fff;border:1px solid #d8dce1;border-radius:8px;">
    <p style="color:#315d47;font-size:12px;font-weight:bold;letter-spacing:.12em;">FIELDNOTES · ORDER UPDATE</p>
    <h1 style="font-size:24px;">Order {{ $order->order_number }}</h1>
    <p>Your order status is now <strong>{{ ucfirst($order->status) }}</strong>.</p>
    @if ($order->tracking_number)
      <p>Carrier: <strong>{{ $order->shipping_carrier }}</strong><br>Tracking number: <strong>{{ $order->tracking_number }}</strong></p>
    @endif
    <p>Order total: <strong>${{ number_format((float) $order->grand_total, 2) }}</strong> · Cash on delivery</p>
  </main>
</body>
</html>
