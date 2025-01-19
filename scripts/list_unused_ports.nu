export def main [port_range_start port_range_end port_range_limit] {
  let used_ports = (sys | get network | get ports | where state == 'LISTEN' | get port | uniq)
        $port_range_start..$port_range_end 
        | where not ($it in $used_ports) 
        | first $port_range_limit
    }