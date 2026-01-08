script {
    use simple_message::message;

    fun script_hello_aptos(account: &signer) {
        message::set_message(account, b"Hello, Aptos!");
    }
}