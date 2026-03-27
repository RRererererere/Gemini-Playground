# LaTeX Math Support Guide

Gemini Studio теперь поддерживает рендеринг математических формул LaTeX в чате!

## Синтаксис

### Inline формулы (в строке)
Используйте одинарные `$` для формул внутри текста:

```
Формула Эйлера: $e^{i\pi} + 1 = 0$
```

Результат: Формула Эйлера: $e^{i\pi} + 1 = 0$

### Display формулы (отдельный блок)
Используйте двойные `$$` для формул в отдельном блоке:

```
$$
\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}
$$
```

Результат:
$$
\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}
$$

## Примеры

### Квадратное уравнение
```
$$
x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}
$$
```

### Матрица
```
$$
\begin{bmatrix}
a & b \\
c & d
\end{bmatrix}
$$
```

### Сумма
```
$$
\sum_{i=1}^{n} i = \frac{n(n+1)}{2}
$$
```

### Предел
```
$$
\lim_{x \to \infty} \frac{1}{x} = 0
$$
```

### Производная
```
$$
\frac{d}{dx}(x^n) = nx^{n-1}
$$
```

### Греческие буквы
```
$\alpha, \beta, \gamma, \delta, \epsilon, \theta, \lambda, \mu, \pi, \sigma, \omega$
```

### Дроби и степени
```
Inline: $\frac{a}{b}$ и $x^2 + y^2 = z^2$

Display:
$$
\left(\frac{a}{b}\right)^n = \frac{a^n}{b^n}
$$
```

### Системы уравнений
```
$$
\begin{cases}
x + y = 5 \\
2x - y = 1
\end{cases}
$$
```

## Совместимость

LaTeX формулы работают:
- ✅ В обычных сообщениях
- ✅ В блоках "Размышления модели"
- ✅ В блоках "DeepThink Analysis"
- ✅ Вместе с кодом и другим markdown форматированием
- ✅ В темной теме с оптимизированными цветами

## Технические детали

- Используется **KaTeX** для быстрого рендеринга
- Плагины: `remark-math` + `rehype-katex`
- Поддержка всех стандартных LaTeX команд KaTeX
- Автоматический скроллинг для длинных формул
- Адаптивный дизайн для мобильных устройств

## Полезные ссылки

- [KaTeX Supported Functions](https://katex.org/docs/supported.html)
- [LaTeX Math Symbols](https://www.overleaf.com/learn/latex/List_of_Greek_letters_and_math_symbols)
