<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class NotificationMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public string $type, public string $messageText)
    {
    }

    public function envelope(): Envelope
    {
        $subject = 'AAK Arbitration Register - '.str_replace('_', ' ', $this->type);

        return new Envelope(subject: $subject);
    }

    public function content(): Content
    {
        return new Content(text: 'emails.notification', with: ['messageText' => $this->messageText]);
    }
}
