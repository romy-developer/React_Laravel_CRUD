<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Models\ApiToken;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;

class MakeStoreAdmin extends Command
{
    protected $signature = 'app:make-admin {email} {--name=Store Admin}';

    protected $description = 'Create a store administrator or promote an existing user.';

    public function handle(): int
    {
        $email = strtolower($this->argument('email'));
        $user = User::firstOrNew(['email' => $email]);

        if (! $user->exists) {
            $password = $this->secret('Choose an administrator password (at least 10 characters)');
            $confirmation = $this->secret('Confirm administrator password');
            if (! $password || strlen($password) < 10 || $password !== $confirmation) {
                $this->error('The passwords must match and contain at least 10 characters.');
                return self::FAILURE;
            }
            $user->name = $this->option('name');
            $user->password = Hash::make($password);
        }

        $roleChanged = $user->role !== 'admin';
        $user->role = 'admin';
        $user->save();
        if ($roleChanged) ApiToken::where('user_id', $user->id)->delete();
        $this->info("{$email} can now sign in as a store administrator.");

        return self::SUCCESS;
    }
}
