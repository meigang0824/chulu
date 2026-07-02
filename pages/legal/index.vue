<template>
  <view class="legal">
    <view class="legal__nav">
      <view class="legal__back" @tap="goBack">‹</view>
      <view class="legal__title">{{ pageTitle }}</view>
      <view class="legal__placeholder"></view>
    </view>

    <scroll-view class="legal__scroll" scroll-y>
      <view class="legal__card">
        <view class="legal__headline">{{ pageTitle }}</view>
        <view class="legal__meta">更新日期：2026年6月26日</view>
        <view class="legal__meta">生效日期：2026年6月26日</view>
        <view class="legal__intro">{{ content.intro }}</view>

        <view v-for="section in content.sections" :key="section.title" class="legal__section">
          <view class="legal__section-title">{{ section.title }}</view>
          <view v-for="item in section.items" :key="item" class="legal__paragraph">{{ item }}</view>
        </view>

        <view class="legal__notice">
          如您对本协议或个人信息保护有疑问，可通过小程序内“联系客服”入口与我们联系。
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script>
const USER_AGREEMENT = {
  intro: '欢迎使用初炉烘焙小程序。请您在登录、下单或使用相关服务前仔细阅读本协议。您勾选同意或继续使用本小程序，即表示您已理解并同意本协议内容。',
  sections: [
    {
      title: '一、服务内容',
      items: [
        '初炉烘焙为用户提供商品浏览、购物车、下单支付、订单查询、配送履约、售后退款、收藏和消息提醒等与烘焙商品团购相关的服务。',
        '商品名称、图片、价格、库存、配送时间、截单时间、限购数量等信息以页面展示和订单确认为准。因原料、生产批次或拍摄光线差异，商品实物可能与展示图片存在合理差异。'
      ]
    },
    {
      title: '二、账号与登录',
      items: [
        '您可以通过微信授权或游客方式使用部分功能。涉及下单、支付、查看订单、申请售后等功能时，可能需要登录并补充必要资料。',
        '您应保证授权或填写的昵称、头像、手机号、收货地址等信息真实、准确、有效。因信息错误导致无法配送、联系或退款的，由您自行承担相应影响。',
        '请妥善管理您的微信账号和登录状态。通过您的账号发起的操作，除有相反证据外，将视为您本人操作。'
      ]
    },
    {
      title: '三、订单、支付与履约',
      items: [
        '您提交订单前应确认商品、数量、收货信息、配送方式、订单金额等信息。订单提交并支付成功后，我们将按订单状态安排备货、制作和配送。',
        '本小程序支持微信支付。支付结果以微信支付系统及本小程序订单状态为准。如因网络、银行、微信支付系统或其他第三方原因导致支付异常，请及时联系客服处理。',
        '烘焙商品具有鲜食属性，配送时间、截单时间、保存方式等可能影响品质。请您按照页面提示及时收货并妥善保存。'
      ]
    },
    {
      title: '四、取消订单与售后',
      items: [
        '已支付订单如需取消，应提交取消申请，待店长审核。同意后系统将按原支付路径发起退款，并同步取消订单、回补库存。',
        '已发货、已完成或涉及食品安全、鲜食损耗的订单，退款、退货或补偿规则将结合商品性质、履约进度、问题凭证和平台实际处理结果确定。',
        '如出现错发、漏发、商品损坏、配送异常等情况，请您尽快通过订单售后入口提交说明和必要凭证，以便核实处理。'
      ]
    },
    {
      title: '五、用户行为规范',
      items: [
        '您不得利用本小程序从事虚假下单、恶意退款、刷单、攻击系统、干扰经营、侵犯他人权益或违反法律法规的行为。',
        '如发现异常交易、恶意操作或安全风险，我们有权根据实际情况采取限制下单、暂停服务、取消异常订单、保留证据并依法处理等措施。'
      ]
    },
    {
      title: '六、责任限制',
      items: [
        '因不可抗力、网络故障、微信平台限制、云服务异常、支付机构故障、配送不可控因素等导致服务中断、延迟或数据异常的，我们将尽力协助处理，但不承担超出法律规定范围的责任。',
        '我们会尽合理努力保障商品和服务质量。对依法应承担的责任，我们将按照法律法规和实际损失情况处理。'
      ]
    },
    {
      title: '七、协议更新',
      items: [
        '我们可能根据业务调整、法律法规变化或平台要求更新本协议。更新后将在小程序内展示，您继续使用服务即视为接受更新后的内容。',
        '如您不同意本协议或后续更新内容，可以停止使用本小程序相关服务。'
      ]
    }
  ]
}

const PRIVACY_POLICY = {
  intro: '初炉烘焙重视您的个人信息保护。本政策说明我们在您使用小程序过程中如何收集、使用、存储、共享和保护您的个人信息，以及您可以如何管理相关信息。',
  sections: [
    {
      title: '一、我们收集的信息',
      items: [
        '账号信息：当您使用微信登录时，我们可能获取微信 openid、头像、昵称等用于识别账号、展示用户资料和关联订单。',
        '订单信息：包括购买商品、数量、金额、支付状态、订单状态、售后状态、退款记录、下单时间、配送履约信息等，用于完成交易和售后服务。',
        '收货与联系信息：包括收货人姓名、手机号、收货地址、备注等，用于配送、售后沟通和订单核验。',
        '图片与文件信息：当您上传头像、商品图片、售后凭证或其他图片时，我们会将相关文件保存至云存储，用于对应功能展示和处理。',
        '设备和运行信息：为保障小程序运行安全和排查问题，我们可能收集必要的操作日志、错误信息、网络状态、设备基础信息。'
      ]
    },
    {
      title: '二、我们如何使用信息',
      items: [
        '用于账号登录、身份识别、权限判断、资料展示和避免重复选择头像昵称。',
        '用于商品购买、购物车、支付、订单查询、配送、售后退款、库存回补和客服沟通。',
        '用于向店长同步新订单、取消申请、售后申请等经营提醒；如您订阅微信服务通知，也可能用于发送与订单或售后相关的通知。',
        '用于统计经营数据、优化页面体验、排查系统错误、防范欺诈和保障交易安全。'
      ]
    },
    {
      title: '三、支付与退款信息',
      items: [
        '支付由微信支付提供服务。我们会保存必要的订单号、支付状态、微信支付交易号、退款单号和退款状态，用于对账、退款和售后查询。',
        '我们不会在小程序前端保存您的银行卡号、支付密码等敏感支付凭证。相关支付能力遵循微信支付的规则和安全要求。'
      ]
    },
    {
      title: '四、信息存储与保护',
      items: [
        '您的信息主要存储在微信云开发环境的数据库和云存储中。我们会采取权限控制、最小必要使用、访问限制等方式保护数据安全。',
        '我们仅在实现本政策所述目的所需期间保存个人信息。法律法规、交易留痕、财务对账、争议处理另有要求的，按照相关要求保存。',
        '互联网环境无法保证绝对安全。如发生个人信息安全事件，我们将按法律法规要求及时采取补救措施并履行通知义务。'
      ]
    },
    {
      title: '五、信息共享与委托处理',
      items: [
        '为完成订单履约，我们可能在必要范围内向配送、支付、云服务、消息通知等服务提供方提供完成服务所必需的信息。',
        '除法律法规要求、取得您的授权或实现本政策说明目的外，我们不会向无关第三方出售、出租或非法共享您的个人信息。',
        '如小程序经营主体、服务范围或数据处理方式发生重大变化，我们会通过适当方式告知您。'
      ]
    },
    {
      title: '六、您的权利',
      items: [
        '您可以在小程序内查看和管理个人资料、收货地址、订单、收藏、购物车等信息。',
        '如您需要更正、删除个人信息，撤回授权，注销或停止使用账号，可通过小程序内客服入口联系我们。我们将在核验身份后依法处理。',
        '部分信息删除或授权撤回后，可能导致相关功能无法继续使用，例如无法下单、配送或处理售后。'
      ]
    },
    {
      title: '七、未成年人保护',
      items: [
        '如您为未成年人，请在监护人指导下使用本小程序并提交订单。监护人应关注未成年人使用网络服务和购买商品的情况。',
        '如监护人发现未成年人未经同意提供个人信息，可联系我们处理。'
      ]
    },
    {
      title: '八、政策更新',
      items: [
        '我们可能根据法律法规、平台要求或业务变化更新本政策。更新后将在小程序内展示，并以更新日期标明。',
        '如您继续使用本小程序，即表示您已阅读并接受更新后的隐私政策。'
      ]
    }
  ]
}

export default {
  data() {
    return {
      type: 'user'
    }
  },
  computed: {
    isPrivacy() {
      return this.type === 'privacy'
    },
    pageTitle() {
      return this.isPrivacy ? '隐私政策' : '用户协议'
    },
    content() {
      return this.isPrivacy ? PRIVACY_POLICY : USER_AGREEMENT
    }
  },
  onLoad(query = {}) {
    this.type = query.type === 'privacy' ? 'privacy' : 'user'
  },
  methods: {
    goBack() {
      uni.navigateBack({
        fail: () => uni.redirectTo({ url: '/pages/auth/login/index' })
      })
    }
  }
}
</script>

<style lang="scss" scoped>
@import '@/common/theme.scss';

.legal {
  min-height: 100vh;
  background: linear-gradient(180deg, #fff8ef 0%, #fff2e3 100%);
  color: #5b2b18;
}

.legal__nav {
  position: sticky;
  top: 0;
  z-index: 5;
  height: 176rpx;
  padding: 88rpx 28rpx 20rpx;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(255, 248, 239, 0.96);
  border-bottom: 1rpx solid rgba(127, 82, 49, 0.08);
}

.legal__back,
.legal__placeholder {
  width: 64rpx;
  height: 64rpx;
}

.legal__back {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 52rpx;
  line-height: 1;
  color: #6b351e;
}

.legal__title {
  font-size: 34rpx;
  font-weight: 800;
  color: #5b2b18;
}

.legal__scroll {
  height: calc(100vh - 176rpx);
  box-sizing: border-box;
}

.legal__card {
  margin: 24rpx;
  padding: 32rpx 28rpx 56rpx;
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 16rpx 42rpx rgba(102, 57, 27, 0.08);
}

.legal__headline {
  font-size: 40rpx;
  line-height: 1.3;
  font-weight: 900;
  color: #5a2a17;
}

.legal__meta {
  margin-top: 10rpx;
  font-size: 24rpx;
  line-height: 1.5;
  color: #a98068;
}

.legal__intro {
  margin-top: 28rpx;
  padding: 22rpx;
  border-radius: 18rpx;
  background: #fff7eb;
  font-size: 27rpx;
  line-height: 1.8;
  color: #74452f;
}

.legal__section {
  margin-top: 34rpx;
}

.legal__section-title {
  font-size: 31rpx;
  line-height: 1.45;
  font-weight: 800;
  color: #5b2b18;
}

.legal__paragraph {
  margin-top: 16rpx;
  font-size: 27rpx;
  line-height: 1.85;
  color: #76513f;
}

.legal__notice {
  margin-top: 42rpx;
  padding: 24rpx;
  border-radius: 18rpx;
  background: #fff1f3;
  color: #a64b5c;
  font-size: 26rpx;
  line-height: 1.7;
}
</style>
