/**
 * Copyright 2017 The Mifos Initiative.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {Component, EventEmitter, Input, OnInit, Output, ViewChild} from '@angular/core';
import {FormComponent} from '../../../../common/forms/form.component';
import {TdStepComponent} from '@covalent/core';
import {FormBuilder, FormControl, ValidatorFn, Validators} from '@angular/forms';
import {FimsValidators} from '../../../../common/validator/validators';
import {TellerTransactionCosts} from '../../../../services/teller/domain/teller-transaction-costs.model';
import {ProductInstance} from '../../../../services/depositAccount/domain/instance/product-instance.model';
import {accountExists} from '../../../../common/validator/account-exists.validator';
import {AccountingService} from '../../../../services/accounting/accounting.service';
import {TransactionType} from '../../../../services/teller/domain/teller-transaction.model';

const withdrawalCheckTypes: TransactionType[] = ['ACCC', 'CWDL'];

const balanceCheckTypes: TransactionType[] = ['ACCT', 'ACCC', 'CWDL'];

export interface TellerTransactionFormData {
  customerIdentifier: string;
  productIdentifier: string;
  accountIdentifier: string;
  targetAccountIdentifier?: string;
  amount: number;
}

@Component({
  selector: 'fims-teller-transaction-form',
  templateUrl: './form.component.html'
})
export class TellerTransactionFormComponent extends FormComponent<TellerTransactionFormData> implements OnInit {

  private _transactionCreated: boolean;

  private _transactionType: TransactionType;

  enableTargetAccount: boolean;

  numberFormat: string = '1.2-2';

  checkCashdrawLimit: boolean;

  checkBalanceLimit: boolean;

  balanceLimit: number;

  @ViewChild('transactionStep') transactionStep: TdStepComponent;

  @ViewChild('confirmationStep') confirmationStep: TdStepComponent;

  @Input('productInstances') productInstances: ProductInstance[];

  @Input('transactionCosts') transactionCosts: TellerTransactionCosts;

  @Input('transactionCreated') set transactionCreated(transactionCreated: boolean) {
    this._transactionCreated = transactionCreated;
    if(transactionCreated) {
      this.confirmationStep.open();
    }
  };

  @Input('error') error: string;

  @Input('transactionType') set transactionType(transactionType: TransactionType) {
    this._transactionType = transactionType;

    if (transactionType === 'ACCT') {
      this.enableTargetAccount = true;
    }

    this.checkCashdrawLimit = this.hasType(withdrawalCheckTypes, transactionType);
    this.checkBalanceLimit = this.hasType(balanceCheckTypes, transactionType);
  }

  @Input('cashdrawLimit') cashdrawLimit: number;

  @Output('onCreateTransaction') onCreateTransaction = new EventEmitter<TellerTransactionFormData>();

  @Output('onConfirmTransaction') onConfirmTransaction = new EventEmitter<void>();

  @Output('onCancelTransaction') onCancelTransaction = new EventEmitter<void>();

  @Output('onCancel') onCancel = new EventEmitter<void>();

  constructor(private formBuilder: FormBuilder, private accountingService: AccountingService) {
    super();
  }

  ngOnInit(): void {
    this.form = this.formBuilder.group({
      productInstance: ['', Validators.required],
      amount: ['']
    });

    if(this.enableTargetAccount) {
      this.form.addControl('targetAccountIdentifier', new FormControl('', [Validators.required], accountExists(this.accountingService)));
    }

    this.form.get('productInstance').valueChanges
      .subscribe(productInstance => this.toggleProductInstance(productInstance));

    this.transactionStep.open();
  }

  private toggleProductInstance(productInstance: ProductInstance): void {
    const amountValidators: ValidatorFn[] = [Validators.required, FimsValidators.minValue(0)];

    this.balanceLimit = productInstance.balance;

    const maxValue = this.getAmountMaxValue(productInstance);

    if(maxValue !== undefined) {
      amountValidators.push(FimsValidators.maxValue(maxValue));
    }

    const amountControl = this.form.get('amount') as FormControl;

    amountControl.setValidators(amountValidators);

    amountControl.updateValueAndValidity();
  }

  private getAmountMaxValue(productInstance: ProductInstance): number {
    if(this.checkBalanceLimit && this.checkCashdrawLimit) {
      return Math.min(this.cashdrawLimit, productInstance.balance);
    }

    if(this.checkBalanceLimit && !this.checkCashdrawLimit) {
      return productInstance.balance;
    }
  }

  private hasType(types: TransactionType[], type: TransactionType): boolean {
    return types.indexOf(type) > -1
  }

  cancel(): void {
    this.onCancel.emit();
  }

  get formData(): TellerTransactionFormData {
    // Not needed
    return null;
  }

  createTransaction(): void {
    const productInstance: ProductInstance = this.form.get('productInstance').value;
    const targetAccountIdentifierControl: FormControl = this.form.get('targetAccountIdentifier') as FormControl;

    const formData: TellerTransactionFormData = {
      productIdentifier: productInstance.productIdentifier,
      accountIdentifier: productInstance.accountIdentifier,
      customerIdentifier: productInstance.customerIdentifier,
      targetAccountIdentifier: targetAccountIdentifierControl ? targetAccountIdentifierControl.value : undefined,
      amount: this.form.get('amount').value
    };

    this.onCreateTransaction.emit(formData);
  }

  confirmTransaction(): void {
    this.onConfirmTransaction.emit();
  }

  cancelTransaction(): void {
    this.onCancelTransaction.emit();
  }

  get transactionCreated(): boolean {
    return this._transactionCreated;
  }

  get createTransactionDisabled(): boolean {
    return this.form.invalid || this.transactionCreated
  }

}