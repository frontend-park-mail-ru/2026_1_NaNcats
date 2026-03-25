export const promoSliderTemplate = `
<div class="auth-image-side promo-slider">
    <img src="{{=it.current.img}}" alt="Food" class="promo-image">
    <div class="promo-text">
        <h2 class="promo-text__title">{{=it.current.title}}</h2>
        <p>{{=it.current.text}}</p>
    </div>
    <div class="promo-nav">
        <div class="nav-arrow nav-arrow_prev"></div>
        <div class="nav-arrow nav-arrow_next"></div>
    </div>
</div>
`;
