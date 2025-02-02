/**
 * Magento 2 extensions for Afterpay Payment
 *
 * @author Afterpay
 * @copyright 2016-2021 Afterpay https://www.afterpay.com
 */
/*browser:true*/
/*global define*/
define(
    [
        'jquery',
        'Magento_Checkout/js/view/payment/default',
        'Magento_Checkout/js/model/quote',
        'Magento_Checkout/js/model/resource-url-manager',
        'mage/storage',
        'mage/url',
        'Magento_Checkout/js/model/payment/additional-validators',
        'Magento_Ui/js/model/messageList',
        'Magento_Customer/js/customer-data',
        'Magento_Customer/js/section-config',
		'Magento_Checkout/js/action/set-billing-address',
        'Afterpay_Afterpay/js/view/payment/method-renderer/afterpayredirect'
    ],
    function ($, Component, quote, resourceUrlManager, storage, mageUrl, additionalValidators, globalMessageList, customerData, sectionConfig,setBillingAddressAction,afterpayRedirect) {
        'use strict';

        return Component.extend({
            /** Don't redirect to the success page immediately after placing order **/
            redirectAfterPlaceOrder: false,
            defaults: {
                template: 'Afterpay_Afterpay/payment/afterpaypayovertime',
                billingAgreement: ''
            },

            /**
             * Terms and condition link
             * @returns {*}
             */
            getTermsConditionUrl: function () {
                return window.checkoutConfig.payment.afterpay.termsConditionUrl;
            },

            /**
             * Get Grand Total of the current cart
             * @returns {*}
             */
            getGrandTotal: function () {

                var total = quote.getCalculatedTotal();
                var format = window.checkoutConfig.priceFormat.pattern
				var afterpay = window.checkoutConfig.payment.afterpay;

                storage.get(resourceUrlManager.getUrlForCartTotals(quote), false)
                .done(
                    function (response) {

                        var amount = response.base_grand_total;
                        var installmentFee = response.base_grand_total / 4;
                        var installmentFeeLast = amount - installmentFee.toFixed(window.checkoutConfig.priceFormat.precision) * 3;

                        $(".afterpay_instalments_amount").text(format.replace(/%s/g, installmentFee.toFixed(window.checkoutConfig.priceFormat.precision)));
                        $(".afterpay_instalments_amount_last").text(format.replace(/%s/g, installmentFeeLast.toFixed(window.checkoutConfig.priceFormat.precision)));


						if (afterpay.currencyCode == 'USD' || afterpay.currencyCode == 'CAD' ) {
							 $(".afterpay_total_amount").text(format.replace(/%s/g, installmentFee.toFixed(window.checkoutConfig.priceFormat.precision)));
							return format.replace(/%s/g, installmentFee);
						} else {
							 $(".afterpay_total_amount").text(format.replace(/%s/g, amount.toFixed(window.checkoutConfig.priceFormat.precision)));
							return format.replace(/%s/g, amount);
						}

                    }
                )
                .fail(
                    function (response) {
                       //do your error handling

                    return 'Error';
                    }
                );
            },

            /**
             * Get Checkout Message based on the currency
             * @returns {*}
             */
            getCheckoutText: function () {

                var afterpay = window.checkoutConfig.payment.afterpay;
                var afterpayCheckoutText = '';
                switch(afterpay.currencyCode){
	                case 'USD':
	                	afterpayCheckoutText = '4 interest-free installments of';
	                	break;
	                case 'CAD':
	                	afterpayCheckoutText = '4 interest-free instalments of';
	                	break;
	                default:
	                	afterpayCheckoutText = 'Four interest-free payments totalling';
                }

                return afterpayCheckoutText;
            },
			getFirstInstalmentText: function () {

                var afterpay = window.checkoutConfig.payment.afterpay;
                var afterpayFirstInstalmentText = '';

                switch(afterpay.currencyCode){
	                case 'USD':
	                case 'CAD':
	                	afterpayFirstInstalmentText = 'Due today';
	                	break;
	                default:
	                	afterpayFirstInstalmentText = 'First instalment';

                }


                return afterpayFirstInstalmentText;
            },
			getTermsText: function () {

                var afterpay = window.checkoutConfig.payment.afterpay;
                var afterpayTermsText = '';

                switch(afterpay.currencyCode){
	                case 'USD':
	                case 'CAD':
	                	afterpayTermsText = 'You will be redirected to the Afterpay website to fill out your payment information. You will be redirected back to our site to complete your order.';
	                	break;
	                default:
	                	afterpayTermsText = 'You will be redirected to the Afterpay website when you proceed to checkout.';
                }

                return afterpayTermsText;
            },
			getTermsLink: function () {

                var afterpay = window.checkoutConfig.payment.afterpay;
                var afterpayCheckoutTermsLink = '';
                switch(afterpay.currencyCode){
	                case 'USD':
	                	afterpayCheckoutTermsLink="https://www.afterpay.com/purchase-payment-agreement";
						break;
	                case 'CAD':
						afterpayCheckoutTermsLink="https://www.afterpay.com/en-CA/instalment-agreement";
						break;
	                default:
						afterpayCheckoutTermsLink="https://www.afterpay.com/terms/";
				}

                return afterpayCheckoutTermsLink;
            },

            /**
             * Returns the installment fee of the payment */
            getAfterpayInstallmentFee: function () {
                // Checking and making sure checkoutConfig data exist and not total 0 dollar
                if (typeof window.checkoutConfig !== 'undefined' &&
                    quote.getCalculatedTotal() > 0) {
                    // Set installment fee from grand total and check format price to be output
                    var installmentFee = quote.getCalculatedTotal() / 4;
                    var format = window.checkoutConfig.priceFormat.pattern;

                    // return with the currency code ($) and decimal setting (default: 2)
                    return format.replace(/%s/g, installmentFee.toFixed(window.checkoutConfig.priceFormat.precision));
                }
            },

            /**
             *  process Afterpay Payment
             */
            continueAfterpayPayment: function () {
                // Added additional validation to check
                if (additionalValidators.validate()) {
                    // start afterpay payment is here
                    var afterpay = window.checkoutConfig.payment.afterpay;
                    // Making sure it using API V2
                    var url = mageUrl.build("afterpay/payment/process");
                    var data = $("#co-shipping-form").serialize();
                    var email = window.checkoutConfig.customerData.email;
                    var ajaxRedirected = false;

                    //CountryCode Object to pass in initialize function.
                    var countryCurrencyMapping ={AUD:"AU", NZD:"NZ", USD:"US",CAD:"CA"};
                    var countryCode = (afterpay.baseCurrencyCode in countryCurrencyMapping)? {countryCode: countryCurrencyMapping[afterpay.baseCurrencyCode]}:{};

                    //Update billing address of the quote
                    const setBillingAddressActionResult = setBillingAddressAction(globalMessageList);

                    setBillingAddressActionResult.done(function () {
                        //handle guest and registering customer emails
                        if (!window.checkoutConfig.quoteData.customer_id) {
                            email = document.getElementById("customer-email").value;
                        }

                        data = data + '&email=' + encodeURIComponent(email);


                        $.ajax({
                            url: url,
                            method: 'post',
                            data: data,
                            beforeSend: function () {
                                $('body').trigger('processStart');
                            }
                        }).done(function (response) {
                            // var data = $.parseJSON(response);
                            var data = response;

                            if (data.success && (typeof data.token !== 'undefined' && data.token !== null && data.token.length) ) {
                                //Init or Initialize Afterpay
                                //Pass countryCode to Initialize function
                                if (typeof AfterPay.initialize === "function") {
                                    AfterPay.initialize(countryCode);
                                } else {
                                    AfterPay.init();
                                }

                                //Waiting for all AJAX calls to resolve to avoid error messages upon redirection
                                $("body").ajaxStop(function () {
									ajaxRedirected = true;
                                    afterpayRedirect.redirectToAfterpay(data);
                                });
								setTimeout(
									function(){
										if(!ajaxRedirected){
											afterpayRedirect.redirectToAfterpay(data);
										}
									}
								,5000);
                            } else if (typeof data.error !== 'undefined' && typeof data.message !== 'undefined' &&
                                data.error && data.message.length) {
                                globalMessageList.addErrorMessage({
                                    'message': data.message
                                });
                            } else {
                                globalMessageList.addErrorMessage({
                                    'message': data.message
                                });
                            }
                        }).fail(function () {
                            window.location.reload();
                        }).always(function () {
                            customerData.invalidate(['cart']);
                            $('body').trigger('processStop');
                        });
                    }).fail(function () {
						window.scrollTo({top: 0, behavior: 'smooth'});
                    });
                }
            },

            /**
             * Start popup or redirect payment
             *
             * @param response
             */
            afterPlaceOrder: function () {

                // start afterpay payment is here
                var afterpay = window.checkoutConfig.payment.afterpay;

                // Making sure it using current flow
                var url = mageUrl.build("afterpay/payment/process");

				//Update billing address of the quote
				setBillingAddressAction(globalMessageList);

                $.ajax({
                    url: url,
                    method:'post',
                    success: function (response) {

                        // var data = $.parseJSON(response);
                        var data = response;

                        if (typeof AfterPay.initialize === "function") {
                            AfterPay.initialize({
                                relativeCallbackURL: window.checkoutConfig.payment.afterpay.afterpayReturnUrl
                            });
                        } else {
                            AfterPay.init({
                                relativeCallbackURL: window.checkoutConfig.payment.afterpay.afterpayReturnUrl
                            });
                        }

                        afterpayRedirect.redirectToAfterpay(data);
                    }
                });
            }
        });
    }
);
