<?php

declare(strict_types=1);

namespace MDcabinet\Core;

/**
 * Jednoduchá validácia s pravidlami v tvare 'required|string|max:190'.
 * Pri chybe vyhodí HttpException::validation() s mapou pole => hláška.
 */
final class Validator
{
    /** @var array<string,string> */
    private array $errors = [];

    /** @var array<string,mixed> */
    private array $valid = [];

    /**
     * @param array<string,mixed>  $data
     * @param array<string,string> $rules
     * @return array<string,mixed> validované hodnoty
     */
    public static function check(array $data, array $rules): array
    {
        $validator = new self();

        foreach ($rules as $field => $ruleString) {
            $validator->validateField($data, $field, explode('|', $ruleString));
        }

        if ($validator->errors !== []) {
            throw HttpException::validation($validator->errors);
        }

        return $validator->valid;
    }

    /**
     * @param array<string,mixed> $data
     * @param list<string>        $rules
     */
    private function validateField(array $data, string $field, array $rules): void
    {
        $value    = $data[$field] ?? null;
        $required = in_array('required', $rules, true);
        $nullable = in_array('nullable', $rules, true);

        // Pravidlo `raw` = hodnotu neorezávaj. Používa ho obsah dokumentu:
        // v Markdowne sú koncové prázdne riadky súčasťou textu.
        if (is_string($value) && !in_array('raw', $rules, true)) {
            $value = trim($value);
        }

        $missing = $value === null || (is_string($value) && trim($value) === '');

        if ($missing) {
            if ($required) {
                $this->errors[$field] = 'Pole je povinné.';
                return;
            }
            if (!$nullable && !array_key_exists($field, $data)) {
                return; // pole vôbec neprišlo – neriešime
            }
            $this->valid[$field] = $value === '' && !$nullable ? '' : null;
            return;
        }

        foreach ($rules as $rule) {
            [$name, $param] = array_pad(explode(':', $rule, 2), 2, null);

            switch ($name) {
                case 'string':
                    if (!is_string($value)) {
                        $this->errors[$field] = 'Očakáva sa text.';
                        return;
                    }
                    break;

                case 'int':
                    if (!is_numeric($value)) {
                        $this->errors[$field] = 'Očakáva sa číslo.';
                        return;
                    }
                    $value = (int) $value;
                    break;

                case 'bool':
                    $value = in_array($value, [true, 1, '1', 'true', 'on', 'yes'], true);
                    break;

                case 'email':
                    if (!filter_var((string) $value, FILTER_VALIDATE_EMAIL)) {
                        $this->errors[$field] = 'Neplatná e-mailová adresa.';
                        return;
                    }
                    $value = mb_strtolower((string) $value);
                    break;

                case 'min':
                    if (is_string($value) && mb_strlen($value, 'UTF-8') < (int) $param) {
                        $this->errors[$field] = 'Minimálna dĺžka je ' . $param . ' znakov.';
                        return;
                    }
                    if (is_int($value) && $value < (int) $param) {
                        $this->errors[$field] = 'Minimálna hodnota je ' . $param . '.';
                        return;
                    }
                    break;

                case 'max':
                    if (is_string($value) && mb_strlen($value, 'UTF-8') > (int) $param) {
                        $this->errors[$field] = 'Maximálna dĺžka je ' . $param . ' znakov.';
                        return;
                    }
                    if (is_int($value) && $value > (int) $param) {
                        $this->errors[$field] = 'Maximálna hodnota je ' . $param . '.';
                        return;
                    }
                    break;

                case 'in':
                    $allowed = explode(',', (string) $param);
                    if (!in_array((string) $value, $allowed, true)) {
                        $this->errors[$field] = 'Povolené hodnoty: ' . implode(', ', $allowed) . '.';
                        return;
                    }
                    break;

                case 'array':
                    if (!is_array($value)) {
                        $this->errors[$field] = 'Očakáva sa zoznam.';
                        return;
                    }
                    break;

                case 'date':
                    if (strtotime((string) $value) === false) {
                        $this->errors[$field] = 'Neplatný dátum.';
                        return;
                    }
                    break;
            }
        }

        $this->valid[$field] = $value;
    }
}
