<?php

namespace App\Mail;

use App\Models\Order;
use App\Models\Refund;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class RefundRecorded extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public Order $order, public Refund $refund)
    {
    }

    public function envelope(): Envelope
    {
        return new Envelope(subject: "Refund update for order {$this->order->order_number}");
    }

    public function content(): Content
    {
        return new Content(view: 'emails.orders.refund-recorded');
    }
}
