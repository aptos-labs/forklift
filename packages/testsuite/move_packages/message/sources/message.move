module simple_message::message {
    use std::string::{String, utf8};
    use std::signer;
    use std::error;

    struct MessageHolder has key {
        message: String,
    }

    public entry fun set_message(account: &signer, message_bytes: vector<u8>) acquires MessageHolder {
        let message = utf8(message_bytes);
        let account_addr = signer::address_of(account);
        if (!exists<MessageHolder>(account_addr)) {
            move_to(account, MessageHolder { message });
        } else {
            let old_message_holder = borrow_global_mut<MessageHolder>(account_addr);
            old_message_holder.message = message;
        }
    }

    #[view]
    public fun get_message(addr: address): String acquires MessageHolder {
        assert!(exists<MessageHolder>(addr), error::not_found(0));
        borrow_global<MessageHolder>(addr).message
    }
}
