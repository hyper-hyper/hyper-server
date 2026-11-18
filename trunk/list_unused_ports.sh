#!/bin/bash

# Function to detect the OS
detect_os() {
    case "$(uname -s)" in
        Linux*)     echo "Linux";;
        Darwin*)    echo "Mac";;
        CYGWIN*|MINGW*) echo "Windows";;
        *)          echo "Unknown";;
    esac
}

# Get the OS
OS=$(detect_os)

# Check if two arguments are provided
if [ "$#" -ne 2 ]; then
    echo "Usage: $0 <start_port> <end_port>"
    exit 1
fi

START_PORT=$1
END_PORT=$2

# Function to list ports in a range
list_ports() {
    local start=$1
    local end=$2

    if [ "$OS" == "Linux" ] || [ "$OS" == "Mac" ]; then
      netstat -an | grep LISTEN | awk '{print $4}' | sed -E 's/.*:([0-9]+)$/\1/' | awk -v start="$PORT_RANGE_START" -v end="$PORT_RANGE_LIMIT" '$1 >= start && $1 <= end' | sort -n | uniq | echo "$(cat -)"
    elif [ "$OS" == "Windows" ]; then
      netstat -an | Select-String LISTENING | ForEach-Object { $_.Matches.Groups[3].Value } | Where-Object { $_ -ge $PORT_RANGE_START -and $_ -le $PORT_RANGE_LIMIT } | Sort-Object -Unique | echo "$(cat -)"
    else
        echo "Unsupported OS"
        exit 1
    fi
}

# List the ports within the specified range
list_ports $PORT_RANGE_START_PORT $PORT_RANGE_LIMIT_PORT
















#!/usr/bin/env bash

PORT_RANGE_START=$1
PORT_RANGE_END=$2
PORT_RANGE_LIMIT=$3

# Detect the shell
shell_type=$(ps -p $$ -o comm=)

# if [[ "$shell_type" == *"nu"* ]]; then
#     # Nushell script
#     echo "Detected Nushell. Using Nushell script:"
#     nu -c "
#     def get_unused_ports [start end limit] {
#         let used_ports = (sys | get network | get ports | where state == 'LISTEN' | get port | uniq)
#         ${PORT_RANGE_START}..${PORT_RANGE_LIMIT} 
#         | where not ($it in $used_ports) 
#         | first $limit
#     }
#     get_unused_ports $PORT_RANGE_START $PORT_RANGE_LIMIT $PORT_RANGE_LIMIT
#     "
#     exit 0
# fi

# Function to get listening ports
get_listening_ports() {
    case "$(uname -s)" in
        Linux*|Darwin*)
            netstat -AaLlnW 2>/dev/null | awk '{print $4}' | sed -E 's/.*:([0-9]+)$/\1/' || ss -tlnp | awk '{print $4}' | grep -oE '[0-9]+' || lsof -i -P -n | grep LISTEN | awk '{print $9}' | grep -oE '[0-9]+$'
            ;;
        CYGWIN*|MINGW32*|MSYS*|MINGW*)
            netstat -ano | findstr LISTENING | awk '{print $2}' | grep -oE '[0-9]+$'
            ;;
        *)
            echo "Unsupported operating system"
            exit 1
            ;;
    esac
}

# Get a list of all listening ports
listening_ports=$(get_listening_ports)

# Create an array of available ports
available_ports=()
for ((port=start; port<=end; port++)); do
    if ! echo "$listening_ports" | grep -q "^$port$"; then
        available_ports+=($port)
    fi
done

# Return the first 'limit' available ports
echo "${available_ports[@]:0:$limit}"
