module simple_randomness::coin_flip {
    use std::signer;
    use aptos_framework::randomness;

    struct FlipResult has key {
        value: bool,
    }

    /// Flips a coin using on-chain randomness and stores the result.
    /// The #[randomness] attribute is required to use the randomness API.
    #[randomness]
    entry fun flip_coin(account: &signer) acquires FlipResult {
        let result = randomness::u8_range(0, 2) == 1;
        let account_addr = signer::address_of(account);
        if (!exists<FlipResult>(account_addr)) {
            move_to(account, FlipResult { value: result });
        } else {
            let flip_result = borrow_global_mut<FlipResult>(account_addr);
            flip_result.value = result;
        }
    }

    #[view]
    public fun get_result(addr: address): bool acquires FlipResult {
        borrow_global<FlipResult>(addr).value
    }
}
