<!doctype html>
<html lang="en">
<body style="margin:0;padding:28px;background:#f3f4f6;color:#17212b;font-family:Arial,sans-serif;">
  <main style="max-width:620px;margin:0 auto;padding:28px;background:#fff;border:1px solid #d8dce1;border-radius:8px;">
    <p style="color:#315d47;font-size:12px;font-weight:bold;letter-spacing:.12em;">FIELDNOTES</p>
    <h1 style="font-size:24px;">Thanks, {{ $order->customer_name }}.</h1>
    <p>We received your order <strong>{{ $order->order_number }}</strong>. Payment is due in cash when your order arrives.</p>
    <table style="width:100%;border-collapse:collapse;margin:20px 0;">
      @foreach ($order->items as $item)
        <tr><td style="padding:10px 0;border-bottom:1px solid #edf0f1;">{{ $item->product_name }} × {{ $item->quantity }}</td><td style="padding:10px 0;border-bottom:1px solid #edf0f1;text-align:right;">${{ number_format((float) $item->line_total, 2) }}</td></tr>
      @endforeach
      @if ($order->coupon_code)
        <tr><td style="padding-top:12px;">Discount ({{ $order->coupon_code }})</td><td style="padding-top:12px;text-align:right;">-${{ number_format((float) $order->discount_total, 2) }}</td></tr>
      @endif
      <tr><td style="padding-top:14px;font-weight:bold;">Due on delivery</td><td style="padding-top:14px;text-align:right;font-weight:bold;">${{ number_format((float) $order->grand_total, 2) }}</td></tr>
    </table>
    <p>We’ll send another note when your order moves through fulfillment.</p>
  </main>
</body>
</html>
