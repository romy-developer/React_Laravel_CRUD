<h1>Refund update</h1>
<p>Hello {{ $order->customer_name }},</p>
<p>A refund of {{ $order->currency }} {{ number_format((float) $refund->amount, 2) }} was recorded for order {{ $order->order_number }}.</p>
<p>Refund note: {{ $refund->note }}</p>
<p>Total refunded so far: {{ $order->currency }} {{ number_format((float) $order->refunds->sum('amount'), 2) }}.</p>
