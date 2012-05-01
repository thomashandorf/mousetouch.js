#!/usr/bin/perl
BEGIN {
   push @INC,'./lib/';
}

use HTTP::Server::Brick;
use HTTP::Status;
use Data::Dumper;

    
our $server = HTTP::Server::Brick->new( port => 9080);
    
$server->mount( '/' => {
        path => '..',
    });

$server->start();
