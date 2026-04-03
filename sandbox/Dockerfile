FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
	sudo \
	curl \
	ca-certificates \
	git \
	bash \
	unzip \
	xfce4 \
	xfce4-terminal \
	dbus-x11 \
	xdotool \
	scrot \
	x11-utils \
	php-cli \
	ruby \
	lua5.4 \
	python3 \
	python3-pip \
	python3-venv \
	&& curl -fsSL https://github.com/kasmtech/KasmVNC/releases/download/v1.4.0/kasmvncserver_jammy_1.4.0_amd64.deb -o /tmp/kasmvnc.deb \
	&& apt-get install -y /tmp/kasmvnc.deb \
	&& rm /tmp/kasmvnc.deb \
	&& curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
	&& apt-get install -y nodejs \
	&& rm -rf /var/lib/apt/lists/* \
	&& useradd -m -s /bin/bash snapflow \
	&& echo "snapflow ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/91-snapflow \
	&& chmod 0440 /etc/sudoers.d/91-snapflow \
	&& mkdir -p /usr/local/lib

RUN npm install -g ts-node typescript typescript-language-server \
	&& pip3 install --no-cache-dir python-lsp-server

USER snapflow
WORKDIR /home/snapflow

RUN sudo curl -fsSL https://go.dev/dl/go1.23.4.linux-amd64.tar.gz | sudo tar -C /usr/local -xz \
	&& curl -fsSL https://bun.sh/install | bash

ENV PATH="/usr/local/go/bin:/home/snapflow/.bun/bin:${PATH}"

RUN printf "kasmvnc\nkasmvnc\n" | kasmvncpasswd -u snapflow -w -r

RUN touch ~/.bashrc

ENTRYPOINT ["sleep", "infinity"]
