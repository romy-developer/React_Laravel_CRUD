<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ResetPasswordLinkNotification extends Notification
{
    public function __construct(private readonly string $token)
    {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $page = in_array($notifiable->role, ['admin', 'fulfillment'], true) ? '/login' : '/account';
        $url = rtrim(config('app.frontend_url'), '/') . $page . '?' . http_build_query([
            'reset_token' => $this->token,
            'email' => $notifiable->getEmailForPasswordReset(),
        ]);

        return (new MailMessage)
            ->subject('Reset your Fieldnotes password')
            ->line('We received a request to reset the password for your Fieldnotes account.')
            ->action('Choose a new password', $url)
            ->line('This link expires in ' . config('auth.passwords.users.expire') . ' minutes. If you did not request this, you can ignore this email.');
    }
}
