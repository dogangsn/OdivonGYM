import { HttpErrorResponse } from '@angular/common/http';
import { Injector } from '@angular/core';
import { of, throwError } from 'rxjs';
import { MobileApi, MobileMembership } from '../api/mobile.api';
import { MemberAccountService } from './member-account.service';
import { OnlinePaymentService } from './online-payment.service';

describe('OnlinePaymentService', () => {
  const pkg = { id: 'p1', name: '3 Aylık', price: 3000, durationDays: 90 };
  let api: jasmine.SpyObj<MobileApi>;
  let account: { reload: jasmine.Spy };
  let service: OnlinePaymentService;

  beforeEach(() => {
    api = jasmine.createSpyObj<MobileApi>('MobileApi', ['renew', 'cardCheckout']);
    account = { reload: jasmine.createSpy('reload').and.resolveTo({ walletBalance: 2000 }) };
    const injector = Injector.create({
      providers: [
        { provide: MobileApi, useValue: api },
        { provide: MemberAccountService, useValue: account },
        { provide: OnlinePaymentService },
      ],
    });
    service = injector.get(OnlinePaymentService);
  });

  it('buys the package through /gym/mobile/membership/renew and refreshes the wallet', async () => {
    api.renew.and.returnValue(of({ endsAt: '2027-01-01T00:00:00.000Z' } as unknown as MobileMembership));
    const result = await service.purchasePackage(pkg);
    expect(api.renew).toHaveBeenCalledWith('p1');
    expect(account.reload).toHaveBeenCalled();
    expect(result).toEqual(jasmine.objectContaining({ success: true, paymentMethod: 'wallet', amount: 3000, newBalance: 2000 }));
    expect(result.newExpiryDate?.toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });

  it('turns server error codes into Turkish messages', async () => {
    const fail = (code: string) =>
      throwError(() => new HttpErrorResponse({ status: 409, error: { success: false, error: { code, message: 'x' } } }));
    api.renew.and.returnValue(fail('GYM_WALLET_INSUFFICIENT'));
    await expectAsync(service.purchasePackage(pkg)).toBeRejectedWithError(/bakiyeniz bu paket için yetersiz/);
    api.renew.and.returnValue(fail('GYM_PACKAGE_NOT_FOUND'));
    await expectAsync(service.purchasePackage(pkg)).toBeRejectedWithError(/artık satışta değil/);
  });

  it('starts a card payment and returns the iyzico page; explains a gym without card payments', async () => {
    api.cardCheckout.and.returnValue(of({ id: 's1', source: 'gym_wallet_topup', amountKurus: 50000, status: 'pending', paymentPageUrl: 'https://sandbox-cpp.iyzipay.com/x' }));
    await expectAsync(service.startCardPayment({ purpose: 'wallet_topup', amount: 500 })).toBeResolvedTo('https://sandbox-cpp.iyzipay.com/x');
    expect(api.cardCheckout).toHaveBeenCalledWith({ purpose: 'wallet_topup', amount: 500 });
    api.cardCheckout.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 409, error: { success: false, error: { code: 'INVALID_STATUS', message: 'x' } } })),
    );
    await expectAsync(service.startCardPayment({ purpose: 'package', packageId: 'p1' })).toBeRejectedWithError(/kartla ödeme şu an açık değil/);
  });
});
