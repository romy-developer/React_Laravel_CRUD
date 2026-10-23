<?php

namespace App\Console\Commands;

use App\Models\ApiToken;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;

class MakeFulfillmentStaff extends Command
{
    protected $signature = 'app:make-fulfillment-staff {email} {--name=Fulfillment Staff}';

    protected $description = 'Create a fulfillment account or promote an existing user to fulfillment staff.';

    public function handle(): int
    {
        $email = strtolower($this->argument('email'));
        $user = User::firstOrNew(['email' => $email]);
        if ($user->exists && $user->role === 'admin') {
            $this->error('An administrator account cannot be demoted to fulfillment staff with this command.');
            return self::FAILURE;
        }

        if (! $user->exists) {
            $password = $this->secret('Choose a fulfillment password (at least 10 characters)');
            $confirmation = $this->secret('Confirm fulfillment password');
            if (! $password || strlen($password) < 10 || $password !== $confirmation) {
                $this->error('The passwords must match and contain at least 10 characters.');
                return self::FAILURE;
            }
            $user->name = $this->option('name');
            $user->password = Hash::make($password);
        }

        $roleChanged = $user->role !== 'fulfillment';
        $user->role = 'fulfillment';
        $user->save();
        if ($roleChanged) ApiToken::where('user_id', $user->id)->delete();

        $this->info("{$email} can now sign in to the fulfillment workspace.");
        return self::SUCCESS;
    }
}
