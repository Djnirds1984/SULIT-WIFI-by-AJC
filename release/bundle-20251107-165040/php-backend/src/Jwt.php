<?php
namespace Sulit;

class Jwt
{
    private string $secret;

    public function __construct(string $secret)
    {
        $this->secret = $secret;
    }

    public function sign(array $payload): string
    {
        $header = ['alg' => 'HS256', 'typ' => 'JWT'];
        $h = $this->b64(json_encode($header));
        $p = $this->b64(json_encode($payload));
        $sig = $this->b64(hash_hmac('sha256', "$h.$p", $this->secret, true));
        return "$h.$p.$sig";
    }

    public function verify(string $token): ?array
    {
        $parts = explode('.', $token);
        if (count($parts) !== 3) return null;
        [$h, $p, $s] = $parts;
        $calc = $this->b64(hash_hmac('sha256', "$h.$p", $this->secret, true));
        if (!hash_equals($calc, $s)) return null;
        $payload = json_decode($this->b64d($p), true);
        if (!$payload) return null;
        if (isset($payload['exp']) && time() >= (int)$payload['exp']) return null;
        return $payload;
    }

    private function b64(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private function b64d(string $data): string
    {
        $re = strtr($data, '-_', '+/');
        $pad = strlen($re) % 4;
        if ($pad) $re .= str_repeat('=', 4 - $pad);
        return base64_decode($re);
    }
}