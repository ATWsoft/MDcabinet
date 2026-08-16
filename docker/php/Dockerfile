FROM php:8.2-apache

RUN apt-get update && apt-get install -y --no-install-recommends \
        libzip-dev libpng-dev libjpeg-dev libfreetype6-dev libwebp-dev \
    && docker-php-ext-configure gd --with-jpeg --with-freetype --with-webp \
    && docker-php-ext-install -j"$(nproc)" pdo_mysql gd zip \
    && a2enmod rewrite headers \
    && rm -rf /var/lib/apt/lists/*

# .htaccess musí byť rešpektovaný (rovnako ako na klasickom hostingu)
RUN printf '<Directory /var/www/html>\n\tAllowOverride All\n\tRequire all granted\n</Directory>\n' \
        > /etc/apache2/conf-available/mdcabinet.conf \
    && a2enconf mdcabinet

COPY php.ini /usr/local/etc/php/conf.d/mdcabinet.ini

WORKDIR /var/www/html
