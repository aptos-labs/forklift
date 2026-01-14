/// TipJar - A tip jar contract using Aptos Objects

module tip_jar::tip_jar {
    use std::signer;
    use std::error;
    use std::string::String;
    use aptos_framework::object::{Self, Object, ExtendRef};
    use aptos_framework::fungible_asset::Metadata;
    use aptos_framework::primary_fungible_store;
    use aptos_framework::aptos_account;
    use aptos_framework::event;

    /// Get the APT fungible asset metadata
    inline fun apt_metadata(): Object<Metadata> {
        object::address_to_object<Metadata>(@aptos_fungible_asset)
    }

    /// Error codes
    const E_NOT_OWNER: u64 = 1;
    const E_INSUFFICIENT_BALANCE: u64 = 2;

    /// The TipJar resource stored inside an Object.
    /// APT is stored in the object's FungibleStore, not in this struct.
    struct TipJar has key {
        /// Name of this tip jar
        name: String,
        /// ExtendRef to generate signers for withdrawals
        extend_ref: ExtendRef,
    }

    /// Event emitted when a new TipJar is created
    #[event]
    struct TipJarCreated has drop, store {
        creator: address,
        name: String,
        tip_jar_address: address,
    }

    // ============ Entry Functions ============

    /// Create a new TipJar object with a custom name. The caller becomes the owner.
    /// Emits a TipJarCreated event with the object address.
    public entry fun create(creator: &signer, name: String) {
        let creator_addr = signer::address_of(creator);

        // Create an unnamed object (non-deterministic address)
        let constructor_ref = object::create_object(creator_addr);
        let tip_jar_addr = object::address_from_constructor_ref(&constructor_ref);

        // Create the TipJar resource (APT stored in object's FungibleStore)
        let tip_jar = TipJar {
            name,
            extend_ref: object::generate_extend_ref(&constructor_ref),
        };

        // Get the object signer and move the TipJar into it
        let object_signer = object::generate_signer(&constructor_ref);
        move_to(&object_signer, tip_jar);

        // Emit event with the object address so callers can discover it
        event::emit(TipJarCreated {
            creator: creator_addr,
            name,
            tip_jar_address: tip_jar_addr,
        });
    }

    /// Donate APT to a tip jar
    public entry fun donate(
        donor: &signer,
        tip_jar: Object<TipJar>,
        amount: u64
    ) {
        let tip_jar_addr = object::object_address(&tip_jar);
        // Transfer APT from donor to the tip jar's FungibleStore
        aptos_account::transfer(donor, tip_jar_addr, amount);
    }

    /// Withdraw all funds from the tip jar (owner only)
    public entry fun withdraw(
        owner: &signer,
        tip_jar: Object<TipJar>
    ) acquires TipJar {
        let owner_addr = signer::address_of(owner);
        assert!(object::is_owner(tip_jar, owner_addr), error::permission_denied(E_NOT_OWNER));

        let tip_jar_addr = object::object_address(&tip_jar);
        let balance = primary_fungible_store::balance(tip_jar_addr, apt_metadata());
        assert!(balance > 0, error::invalid_state(E_INSUFFICIENT_BALANCE));

        // Transfer all APT from tip jar to owner using the object signer
        let jar = borrow_global<TipJar>(tip_jar_addr);
        let object_signer = object::generate_signer_for_extending(&jar.extend_ref);
        aptos_account::transfer(&object_signer, owner_addr, balance);
    }

    /// Transfer ownership of the tip jar to a new owner
    public entry fun transfer(
        owner: &signer,
        tip_jar: Object<TipJar>,
        new_owner: address
    ) {
        object::transfer(owner, tip_jar, new_owner);
    }

    // ============ View Functions ============

    #[view]
    /// Get the name of the tip jar
    public fun get_name(tip_jar: Object<TipJar>): String acquires TipJar {
        let tip_jar_addr = object::object_address(&tip_jar);
        let jar = borrow_global<TipJar>(tip_jar_addr);
        jar.name
    }

    #[view]
    /// Get the current balance of the tip jar
    public fun get_balance(tip_jar: Object<TipJar>): u64 {
        let tip_jar_addr = object::object_address(&tip_jar);
        primary_fungible_store::balance(tip_jar_addr, apt_metadata())
    }

    #[view]
    /// Get the owner of the tip jar
    public fun get_owner(tip_jar: Object<TipJar>): address {
        object::owner(tip_jar)
    }

    #[view]
    /// Check if an address is the owner of the tip jar
    public fun is_owner(tip_jar: Object<TipJar>, addr: address): bool {
        object::is_owner(tip_jar, addr)
    }
}
