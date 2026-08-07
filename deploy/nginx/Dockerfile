# Edge proxy for the explorer: security headers + reverse proxy to the Next.js
# component. The upstream is injected at runtime (EXPLORER_WEB_UPSTREAM) so the
# same image works against docker-compose service names or cluster DNS.
FROM nginx:1.27-alpine

# The stock image envsubsts /etc/nginx/templates/*.template into conf.d at start.
ENV EXPLORER_WEB_UPSTREAM=explorer-web:3000
COPY explorer.conf.template /etc/nginx/templates/explorer.conf.template

EXPOSE 8080
