<?php

declare(strict_types=1);

namespace MDcabinet\Core;

/**
 * Small rule-based validator: 'required|string|max:190'.
 * On failure it throws HttpException::validation() with a field => message map.
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
     * @return array<string,mixed> the validated values
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

        // The `raw` rule means "do not trim". Document content uses it:
        // in Markdown, trailing blank lines are part of the text.
        if (is_string($value) && !in_array('raw', $rules, true)) {
            $value = trim($value);
        }

        $missing = $value === null || (is_string($value) && trim($value) === '');

        if ($missing) {
            if ($required) {
                $this->errors[$field] = Lang::t('This field is required.');
                return;
            }
            if (!$nullable && !array_key_exists($field, $data)) {
                return; // the field was not submitted at all – nothing to check
            }
            $this->valid[$field] = $value === '' && !$nullable ? '' : null;
            return;
        }

        foreach ($rules as $rule) {
            [$name, $param] = array_pad(explode(':', $rule, 2), 2, null);

            switch ($name) {
                case 'string':
                    if (!is_string($value)) {
                        $this->errors[$field] = Lang::t('Text expected.');
                        return;
                    }
                    break;

                case 'int':
                    if (!is_numeric($value)) {
                        $this->errors[$field] = Lang::t('A number is expected.');
                        return;
                    }
                    $value = (int) $value;
                    break;

                case 'bool':
                    $value = in_array($value, [true, 1, '1', 'true', 'on', 'yes'], true);
                    break;

                case 'email':
                    if (!filter_var((string) $value, FILTER_VALIDATE_EMAIL)) {
                        $this->errors[$field] = Lang::t('Invalid e-mail address.');
                        return;
                    }
                    $value = mb_strtolower((string) $value);
                    break;

                case 'min':
                    if (is_string($value) && mb_strlen($value, 'UTF-8') < (int) $param) {
                        $this->errors[$field] = Lang::t('Minimum length: {min} characters.', ['min' => (int) $param]);
                        return;
                    }
                    if (is_int($value) && $value < (int) $param) {
                        $this->errors[$field] = Lang::t('Minimum value: {min}.', ['min' => (int) $param]);
                        return;
                    }
                    break;

                case 'max':
                    if (is_string($value) && mb_strlen($value, 'UTF-8') > (int) $param) {
                        $this->errors[$field] = Lang::t('Maximum length: {max} characters.', ['max' => (int) $param]);
                        return;
                    }
                    if (is_int($value) && $value > (int) $param) {
                        $this->errors[$field] = Lang::t('Maximum value: {max}.', ['max' => (int) $param]);
                        return;
                    }
                    break;

                case 'in':
                    $allowed = explode(',', (string) $param);
                    if (!in_array((string) $value, $allowed, true)) {
                        $this->errors[$field] = Lang::t('Allowed values: {values}.', ['values' => implode(', ', $allowed)]);
                        return;
                    }
                    break;

                case 'array':
                    if (!is_array($value)) {
                        $this->errors[$field] = Lang::t('A list is expected.');
                        return;
                    }
                    break;

                case 'date':
                    if (strtotime((string) $value) === false) {
                        $this->errors[$field] = Lang::t('Invalid date.');
                        return;
                    }
                    break;
            }
        }

        $this->valid[$field] = $value;
    }
}
